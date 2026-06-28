-- ==============================================================
-- MIGRAÇÃO 046: Trial com expiração por tempo + auto-deleção
--
-- Regras:
--   - Trial dura 14 dias OU 15 inscrições (o que acontecer primeiro)
--   - Ao expirar: status → 'suspended', trial_suspended_at = now()
--   - Grace period: 14 dias após suspensão
--   - Após grace period: soft delete + limpeza de dados
-- ==============================================================

-- ==============================================================
-- (1) ADICIONAR COLUNAS trial_ends_at + trial_suspended_at
-- ==============================================================

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS trial_suspended_at TIMESTAMPTZ;

-- ==============================================================
-- (2) ATUALIZAR handle_new_user() para setar trial_ends_at
-- ==============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_name TEXT;
  v_church_id   UUID;
BEGIN
  v_church_name := NEW.raw_user_meta_data->>'church_name';

  IF v_church_name IS NULL OR v_church_name = '' THEN
    v_church_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  END IF;

  INSERT INTO public.churches (name, status, trial_ends_at)
  VALUES (v_church_name, 'trial', now() + INTERVAL '14 days')
  RETURNING id INTO v_church_id;

  INSERT INTO public.user_roles (user_id, role, church_id)
  VALUES (NEW.id, 'admin', v_church_id);

  RETURN NEW;
END;
$$;

-- ==============================================================
-- (3) ATUALIZAR check_trial_registration_limit()
--     Também bloqueia se trial expirou por tempo
-- ==============================================================

CREATE OR REPLACE FUNCTION public.check_trial_registration_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id   UUID;
  v_status      VARCHAR;
  v_count       BIGINT;
  v_trial_ends  TIMESTAMPTZ;
BEGIN
  SELECT church_id INTO v_church_id
  FROM public.events
  WHERE id = NEW.event_id;

  IF v_church_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.status, c.trial_ends_at INTO v_status, v_trial_ends
  FROM public.churches c
  WHERE c.id = v_church_id;

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

-- Atualizar também a função pública
CREATE OR REPLACE FUNCTION public.is_event_registration_blocked(event_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id   UUID;
  v_status      VARCHAR;
  v_trial_ends  TIMESTAMPTZ;
  v_count       BIGINT;
BEGIN
  SELECT church_id INTO v_church_id FROM public.events WHERE id = event_uuid;
  IF v_church_id IS NULL THEN RETURN false; END IF;

  SELECT c.status, c.trial_ends_at INTO v_status, v_trial_ends
  FROM public.churches c WHERE c.id = v_church_id;

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
-- (4) FUNÇÃO: expirar trials vencidos
-- ==============================================================

CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.churches
  SET status = 'suspended',
      trial_suspended_at = now()
  WHERE status = 'trial'
    AND deleted_at IS NULL
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    RAISE NOTICE '% trials expirados e suspensos', v_count;
  END IF;

  RETURN v_count;
END;
$$;

-- ==============================================================
-- (5) FUNÇÃO: limpar trials suspensos há mais de 14 dias
-- ==============================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_church  RECORD;
BEGIN
  FOR v_church IN
    SELECT c.id
    FROM public.churches c
    WHERE c.status = 'suspended'
      AND c.deleted_at IS NULL
      AND c.trial_suspended_at IS NOT NULL
      AND c.trial_suspended_at < now() - INTERVAL '14 days'
  LOOP
    -- Soft delete da igreja
    UPDATE public.churches
    SET deleted_at = now()
    WHERE id = v_church.id;

    -- Limpar roles associadas
    DELETE FROM public.user_roles
    WHERE church_id = v_church.id;

    -- Limpar registros de rate limit
    DELETE FROM public.rate_limits
    WHERE key LIKE 'webhook:payment:%';

    v_deleted := v_deleted + 1;
    RAISE NOTICE 'Trial expirado removido: %', v_church.id;
  END LOOP;

  RETURN v_deleted;
END;
$$;

-- ==============================================================
-- (6) CRON JOBS
-- ==============================================================

-- Expirar trials diariamente às 03:00 UTC (junto com orphans)
SELECT cron.schedule(
  'expire-trials',
  '0 3 * * *',
  $$SELECT public.expire_trials()$$
);

-- Limpar trials suspensos há 14+ dias, às 03:15 UTC
SELECT cron.schedule(
  'cleanup-expired-trials',
  '15 3 * * *',
  $$SELECT public.cleanup_expired_trials()$$
);

-- ==============================================================
-- (7) VIEW para auditoria de trials
-- ==============================================================

CREATE OR REPLACE VIEW public.v_trial_status AS
SELECT
  c.id,
  c.name,
  c.status,
  c.trial_ends_at,
  c.trial_suspended_at,
  c.created_at,
  CASE
    WHEN c.status = 'trial' AND c.trial_ends_at > now() THEN
      EXTRACT(DAY FROM c.trial_ends_at - now())::INTEGER
    WHEN c.status = 'trial' AND c.trial_ends_at <= now() THEN
      0
    WHEN c.status = 'suspended' AND c.trial_suspended_at IS NOT NULL THEN
      -EXTRACT(DAY FROM now() - c.trial_suspended_at - INTERVAL '14 days')::INTEGER
    ELSE NULL
  END AS days_remaining,
  (SELECT COUNT(*) FROM public.registrations r WHERE r.church_id = c.id AND r.deleted_at IS NULL) AS registration_count
FROM public.churches c
WHERE c.deleted_at IS NULL
ORDER BY c.created_at DESC;

-- ==============================================================
-- FIM DA MIGRAÇÃO 046
-- ==============================================================
