-- ==============================================================
-- MIGRAÇÃO 041: Critical fixes — índices, constraints, validações
--
-- Resolve 6 problemas identificados na auditoria de escalabilidade:
-- C1: registrations.email sem índice (rate limit O(n) por INSERT)
-- C2: payments.registration_id sem índice (RESTRICT check O(n))
-- C3: event_lots.event_id sem índice (5 RLS policies subquery/row)
-- P6: churches.status sem CHECK constraint
-- P7: check_trial_registration_limit não filtra deleted_at
-- S5: set_active_church não valida existência da igreja
-- ==============================================================

-- ==============================================================
-- C1: Índice para rate limit trigger (registrations.email)
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_registrations_email_created
  ON public.registrations (LOWER(email), created_at DESC);

-- ==============================================================
-- C2: Índice para payments FK (RESTRICT check)
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_payments_registration_id
  ON public.payments (registration_id);

-- ==============================================================
-- C3: Índice para event_lots FK (RLS subqueries)
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_event_lots_event_id
  ON public.event_lots (event_id);

-- ==============================================================
-- P6: CHECK constraint em churches.status
-- ==============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'churches_status_check'
  ) THEN
    ALTER TABLE public.churches
      ADD CONSTRAINT churches_status_check
      CHECK (status IN ('trial', 'active', 'suspended', 'canceled'));
  END IF;
END;
$$;

-- ==============================================================
-- P7: Filtrar deleted_at IS NULL no limite trial
-- ==============================================================
CREATE OR REPLACE FUNCTION public.check_trial_registration_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id UUID;
  v_status    VARCHAR;
  v_count     BIGINT;
BEGIN
  SELECT church_id INTO v_church_id
  FROM public.events
  WHERE id = NEW.event_id;

  IF v_church_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.status INTO v_status
  FROM public.churches c
  WHERE c.id = v_church_id;

  IF v_status != 'trial' THEN
    RETURN NEW;
  END IF;

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

-- Atualiza também a função pública (bypass RLS) com o mesmo filtro
CREATE OR REPLACE FUNCTION public.is_event_registration_blocked(event_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id UUID;
  v_status    VARCHAR;
  v_count     BIGINT;
BEGIN
  SELECT church_id INTO v_church_id FROM public.events WHERE id = event_uuid;
  IF v_church_id IS NULL THEN RETURN false; END IF;

  SELECT c.status INTO v_status FROM public.churches c WHERE c.id = v_church_id;
  IF v_status != 'trial' THEN RETURN false; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.registrations r
  WHERE r.church_id = v_church_id
    AND r.deleted_at IS NULL;

  RETURN v_count >= 15;
END;
$$;

-- ==============================================================
-- S5: Validar existência + deleted_at em set_active_church
-- ==============================================================
CREATE OR REPLACE FUNCTION public.set_active_church(p_church_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'church_role') != 'super_admin' THEN
    RAISE EXCEPTION 'Apenas super_admin pode trocar contexto de igreja';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.churches
    WHERE id = p_church_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Igreja não encontrada ou removida';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('church_id', p_church_id)
  WHERE id = auth.uid();
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 041
-- ==============================================================
