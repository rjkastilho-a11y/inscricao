-- ==============================================================
-- MIGRATION 009: Trial limit — PLG model (15 inscrições)
-- Idempotente: pode rodar múltiplas vezes sem efeito colateral
-- ==============================================================

-- ==============================================================
-- (1) ADICIONAR COLUNA status NA TABELA churches
-- ==============================================================
ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'trial';

-- ==============================================================
-- (2) ATUALIZAR IGREJAS EXISTENTES PARA 'active'
-- ==============================================================
UPDATE public.churches
  SET status = 'active'
  WHERE status = 'trial';

-- ==============================================================
-- (3) FUNÇÃO DE VERIFICAÇÃO DO LIMITE DO TRIAL
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
  -- Obtém o church_id do evento vinculado
  SELECT church_id INTO v_church_id
  FROM public.events
  WHERE id = NEW.event_id;

  IF v_church_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Consulta o status da igreja
  SELECT c.status INTO v_status
  FROM public.churches c
  WHERE c.id = v_church_id;

  -- Só bloqueia se for trial
  IF v_status != 'trial' THEN
    RETURN NEW;
  END IF;

  -- Conta inscrições globais da igreja
  SELECT COUNT(*) INTO v_count
  FROM public.registrations
  WHERE church_id = v_church_id;

  IF v_count >= 15 THEN
    RAISE EXCEPTION 'Limite de 15 inscrições do plano gratuito atingido.';
  END IF;

  RETURN NEW;
END;
$$;

-- ==============================================================
-- (4) TRIGGER BEFORE INSERT
-- ==============================================================
DROP TRIGGER IF EXISTS trg_registrations_check_trial ON public.registrations;

CREATE TRIGGER trg_registrations_check_trial
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.check_trial_registration_limit();

-- ==============================================================
-- (5) FUNÇÃO PÚBLICA PARA O FRONTEND (bypass RLS)
-- ==============================================================
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

  SELECT COUNT(*) INTO v_count FROM public.registrations r WHERE r.church_id = v_church_id;
  RETURN v_count >= 15;
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 009
-- ==============================================================
