-- ==============================================================
-- MIGRAÇÃO 052: Enforcement de suspensão/bloqueio no backend
--
-- Problema: check_trial_registration_limit e is_event_registration_blocked
-- só verificavam status='trial'. Igredas com is_active=false ou
-- status='suspended' continuavam aceitando inscrições.
--
-- Correção: Adicionar verificações de is_active e status em ambas
-- as funções, garantindo que o backend bloqueia independentemente
-- do frontend.
-- ==============================================================

-- ==============================================================
-- (1) ATUALIZAR check_trial_registration_limit()
--     Adiciona bloqueio para is_active=false e status='suspended'
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
  v_is_active   BOOLEAN;
  v_count       BIGINT;
  v_trial_ends  TIMESTAMPTZ;
BEGIN
  SELECT church_id INTO v_church_id
  FROM public.events
  WHERE id = NEW.event_id;

  IF v_church_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.status, c.is_active, c.trial_ends_at
  INTO v_status, v_is_active, v_trial_ends
  FROM public.churches c
  WHERE c.id = v_church_id;

  -- Bloqueio manual: igreja desativada pelo super admin
  IF v_is_active = false THEN
    RAISE EXCEPTION 'Esta igreja está desativada. Contacte o suporte.';
  END IF;

  -- Bloqueio automático: trial expirado (status = 'suspended')
  IF v_status = 'suspended' THEN
    RAISE EXCEPTION 'Assinatura suspensa. Assine um plano para continuar.';
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
-- (2) ATUALIZAR is_event_registration_blocked()
--     Retorna true para is_active=false e status='suspended'
-- ==============================================================

CREATE OR REPLACE FUNCTION public.is_event_registration_blocked(event_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id   UUID;
  v_status      VARCHAR;
  v_is_active   BOOLEAN;
  v_trial_ends  TIMESTAMPTZ;
  v_count       BIGINT;
BEGIN
  SELECT church_id INTO v_church_id FROM public.events WHERE id = event_uuid;
  IF v_church_id IS NULL THEN RETURN false; END IF;

  SELECT c.status, c.is_active, c.trial_ends_at
  INTO v_status, v_is_active, v_trial_ends
  FROM public.churches c WHERE c.id = v_church_id;

  -- Bloqueio manual: igreja desativada
  IF v_is_active = false THEN RETURN true; END IF;

  -- Bloqueio automático: trial expirado
  IF v_status = 'suspended' THEN RETURN true; END IF;

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
-- FIM DA MIGRAÇÃO 052
-- ==============================================================
