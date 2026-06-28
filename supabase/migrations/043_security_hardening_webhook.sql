-- ==============================================================
-- MIGRAÇÃO 043: Security hardening — webhook + role protection
--
-- S2: Impede que admin não-super_admin atribua role super_admin
-- W-2: Processamento atômico de pagamento via RPC (sem race condition)
-- W-1: Rate limiting no webhook
-- ==============================================================

-- ==============================================================
-- S2: Trigger para impedir auto-promoção a super_admin
--
-- A política RLS user_roles_admin_manage permite que admin
-- insira qualquer role. Este trigger adiciona uma camada
-- de proteção no banco: só super_admin pode atribuir super_admin.
-- ==============================================================

CREATE OR REPLACE FUNCTION public.prevent_super_admin_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'super_admin' THEN
    -- Verificar se o requesting user é super_admin via JWT
    IF (auth.jwt() -> 'app_metadata' ->> 'church_role') != 'super_admin' THEN
      RAISE EXCEPTION 'Apenas super_admin pode atribuir role super_admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_promotion ON public.user_roles;

CREATE TRIGGER trg_prevent_super_admin_promotion
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_promotion();

-- ==============================================================
-- W-2: RPC atômico para processamento de pagamento
--
-- Envolve UPDATE + INSERT em uma transação PL/pgSQL.
-- Elimina race condition do webhook (dois webhooks simultâneos
-- para a mesma inscrição).
-- ==============================================================

CREATE OR REPLACE FUNCTION public.process_webhook_payment(
  p_registration_id UUID,
  p_amount DECIMAL,
  p_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg RECORD;
  v_payment_exists BOOLEAN;
BEGIN
  -- 1. Lock na inscrição (FOR UPDATE impede concorrência)
  SELECT id, payment_status INTO v_reg
  FROM public.registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'registration_not_found', 'status', 404);
  END IF;

  -- 2. Idempotência: já pago
  IF v_reg.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', 200);
  END IF;

  -- 3. Rejeitar se reembolsado
  IF v_reg.payment_status = 'refunded' THEN
    RETURN jsonb_build_object('error', 'registration_refunded', 'status', 409);
  END IF;

  -- 4. Verificar pagamento existente (dupla verificação)
  SELECT EXISTS(
    SELECT 1 FROM public.payments
    WHERE registration_id = p_registration_id AND status = 'paid'
  ) INTO v_payment_exists;

  IF v_payment_exists THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', 200);
  END IF;

  -- 5. Atualizar inscrição
  UPDATE public.registrations
  SET payment_status = 'paid'
  WHERE id = p_registration_id;

  -- 6. Inserir pagamento
  INSERT INTO public.payments (registration_id, amount, method, status, paid_at)
  VALUES (p_registration_id, p_amount, p_method, 'paid', now());

  RETURN jsonb_build_object('ok', true, 'status', 200);
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback automático em caso de erro
    RETURN jsonb_build_object('error', SQLERRM, 'status', 500);
END;
$$;

-- ==============================================================
-- W-1: Função de rate limit para webhook
--
-- Usa a tabela rate_limits existente (migração 037).
-- Limita: 10 pagamentos por registration_id por minuto.
-- ==============================================================

CREATE OR REPLACE FUNCTION public.check_webhook_rate_limit(
  p_registration_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_key TEXT;
BEGIN
  v_key := 'webhook:payment:' || p_registration_id::text;

  SELECT COUNT(*) INTO v_count
  FROM public.rate_limits
  WHERE key = v_key
    AND action = 'payment'
    AND created_at > now() - INTERVAL '1 minute';

  IF v_count >= 10 THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limits (key, action, created_at)
  VALUES (v_key, 'payment', now());

  RETURN true;
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 043
-- ==============================================================
