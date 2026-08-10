-- ==============================================================
-- MIGRATION 094: Planos (Mensal/Anual) + Chancela VIP
-- Idempotente. Compatível com contas legadas (plan_type='monthly', is_vip=false)
-- ==============================================================

-- ==============================================================
-- (1) ENUM plan_type_enum — PostgreSQL não suporta CREATE TYPE IF NOT EXISTS
-- ==============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type_enum') THEN
    CREATE TYPE public.plan_type_enum AS ENUM ('monthly', 'annual');
  END IF;
END;
$$;

-- ==============================================================
-- (1b) FUNÇÃO AUXILIAR master_email — fonte única do e-mail master
--      Se o e-mail mestre mudar, edite SÓ aqui (usado por 094/095/096)
-- ==============================================================
CREATE OR REPLACE FUNCTION public.master_email()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'rj.kastilho@gmail.com'::text;
$$;

-- ==============================================================
-- (2) COLUNAS NA TABELA churches (default preserva contas legadas)
-- ==============================================================
ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS plan_type public.plan_type_enum NOT NULL DEFAULT 'monthly';

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.churches.plan_type IS 'Plano contratado: monthly ou annual (default monthly para contas legadas)';
COMMENT ON COLUMN public.churches.is_vip IS 'Chancela VIP concedida pelo admin master';

-- ==============================================================
-- (3) RPC admin_update_church_plan
--     Segurança: APENAS e-mail master, lido do JWT em memória (sem query em auth.users)
--     Auto-ativação: conceder 'annual' ou VIP força status='active', is_active=true e limpa trial
-- ==============================================================
CREATE OR REPLACE FUNCTION public.admin_update_church_plan(
  target_church_id UUID,
  new_plan         public.plan_type_enum,
  set_vip          BOOLEAN
)
RETURNS public.churches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email TEXT;
  v_church       public.churches%ROWTYPE;
BEGIN
  -- 1. Segurança estrita: e-mail master vindo do JWT (zero round-trip ao banco)
  v_caller_email := auth.jwt() ->> 'email';

  IF v_caller_email IS NULL OR lower(v_caller_email) <> lower(public.master_email()) THEN
    RAISE EXCEPTION 'Apenas o administrador master pode alterar planos';
  END IF;

  -- 2. Auto-ativação: anual ou VIP libera a conta por completo
  IF new_plan = 'annual' OR set_vip THEN
    UPDATE public.churches
    SET plan_type          = new_plan,
        is_vip             = set_vip,
        status             = 'active',
        is_active          = true,
        trial_ends_at      = NULL,
        trial_suspended_at = NULL
    WHERE id = target_church_id
    RETURNING * INTO v_church;
  ELSE
    -- Downgrade (mensal/revogar VIP): não mexe em status/is_active
    UPDATE public.churches
    SET plan_type = new_plan,
        is_vip    = set_vip
    WHERE id = target_church_id
    RETURNING * INTO v_church;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Igreja não encontrada';
  END IF;

  -- 3. Auditoria (INSERT direto, já que a função é SECURITY DEFINER e o e-mail foi validado)
  INSERT INTO public.audit_log (actor_id, action, target_church_id, metadata)
  VALUES (
    auth.uid(),
    'admin_update_church_plan',
    target_church_id,
    jsonb_build_object('plan_type', new_plan, 'is_vip', set_vip)
  );

  RETURN v_church;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_church_plan(UUID, public.plan_type_enum, BOOLEAN) TO authenticated;

-- ==============================================================
-- (4) DEFESA EM PROFUNDIDADE: trial dá "passe livre" para igreja VIP ou Anual
--     (a) Trigger check_trial_registration_limit — versão 052 + bypass
-- ==============================================================
CREATE OR REPLACE FUNCTION public.check_trial_registration_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id  UUID;
  v_status     VARCHAR;
  v_is_active  BOOLEAN;
  v_is_vip     BOOLEAN;
  v_plan_type  public.plan_type_enum;
  v_count      BIGINT;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  SELECT church_id INTO v_church_id
  FROM public.events
  WHERE id = NEW.event_id;

  IF v_church_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.status, c.is_active, c.trial_ends_at, c.is_vip, c.plan_type
  INTO v_status, v_is_active, v_trial_ends, v_is_vip, v_plan_type
  FROM public.churches c
  WHERE c.id = v_church_id;

  -- Bloqueio manual: igreja desativada pelo super admin (SEMPRE vale, mesmo p/ VIP/Anual)
  IF v_is_active = false THEN
    RAISE EXCEPTION 'Esta igreja está desativada. Contacte o suporte.';
  END IF;

  -- Bloqueio automático: assinatura suspensa (SEMPRE vale)
  IF v_status = 'suspended' THEN
    RAISE EXCEPTION 'Assinatura suspensa. Assine um plano para continuar.';
  END IF;

  -- PASSE LIVRE: igreja VIP ou Anual não tem limites de trial
  IF v_plan_type = 'annual' OR v_is_vip THEN
    RETURN NEW;
  END IF;

  -- Se não é trial, não bloqueia
  IF v_status != 'trial' THEN
    RETURN NEW;
  END IF;

  -- Bloqueio por tempo: trial expirou
  IF v_trial_ends IS NOT NULL AND now() > v_trial_ends THEN
    RAISE EXCEPTION 'Período de trial expirado. Assine um plano para continuar.';
  END IF;

  -- Bloqueio por inscrições: 15 atingidas
  SELECT COUNT(*) INTO v_count
  FROM public.registrations
  WHERE church_id = v_church_id
    AND deleted_at IS NULL;

  IF v_count >= 15 THEN
    RAISE EXCEPTION 'Limite de 15 inscrições do plano gratuito atingido.';
  END IF;

  RETURN NEW;
END;
$$;

-- ==============================================================
--     (b) is_event_registration_blocked — versão 052 + bypass
-- ==============================================================
CREATE OR REPLACE FUNCTION public.is_event_registration_blocked(event_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id  UUID;
  v_status     VARCHAR;
  v_is_active  BOOLEAN;
  v_is_vip     BOOLEAN;
  v_plan_type  public.plan_type_enum;
  v_trial_ends TIMESTAMPTZ;
  v_count      BIGINT;
BEGIN
  SELECT church_id INTO v_church_id FROM public.events WHERE id = event_uuid;
  IF v_church_id IS NULL THEN RETURN false; END IF;

  SELECT c.status, c.is_active, c.trial_ends_at, c.is_vip, c.plan_type
  INTO v_status, v_is_active, v_trial_ends, v_is_vip, v_plan_type
  FROM public.churches c WHERE c.id = v_church_id;

  -- Bloqueio manual: igreja desativada
  IF v_is_active = false THEN RETURN true; END IF;

  -- Bloqueio automático: trial expirado/suspenso
  IF v_status = 'suspended' THEN RETURN true; END IF;

  -- PASSE LIVRE: VIP ou Anual nunca bloqueada por limites de trial
  IF v_plan_type = 'annual' OR v_is_vip THEN RETURN false; END IF;

  -- Se não é trial, não bloqueia
  IF v_status != 'trial' THEN RETURN false; END IF;

  -- Bloqueio por tempo
  IF v_trial_ends IS NOT NULL AND now() > v_trial_ends THEN
    RETURN true;
  END IF;

  -- Bloqueio por inscrições
  SELECT COUNT(*) INTO v_count
  FROM public.registrations r
  WHERE r.church_id = v_church_id
    AND r.deleted_at IS NULL;

  RETURN v_count >= 15;
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 094
-- ==============================================================
