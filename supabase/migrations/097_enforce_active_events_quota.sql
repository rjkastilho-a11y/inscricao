-- ==============================================================
-- MIGRATION 097: Limite de eventos ativos por igreja
-- Idempotente: pode rodar múltiplas vezes sem efeito colateral
-- ==============================================================

-- ==============================================================
-- (1) FUNÇÃO DE VERIFICAÇÃO DO LIMITE DE EVENTOS ATIVOS
-- ==============================================================
CREATE OR REPLACE FUNCTION public.enforce_active_events_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id  UUID;
  v_plan_type  public.plan_type_enum;
  v_is_vip     BOOLEAN;
  v_count      BIGINT;
BEGIN
  v_church_id := NEW.church_id;

  IF v_church_id IS NULL THEN
    SELECT church_id INTO v_church_id
    FROM public.user_roles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_church_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan_type, is_vip
  INTO v_plan_type, v_is_vip
  FROM public.churches
  WHERE id = v_church_id
  FOR UPDATE;

  IF v_plan_type IS NULL OR v_is_vip IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_is_vip = true OR v_plan_type = 'annual' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.events
  WHERE church_id = v_church_id
    AND is_open = true
    AND deleted_at IS NULL
    AND id != NEW.id;

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'Limite de 2 eventos ativos do plano mensal atingido.';
  END IF;

  RETURN NEW;
END;
$$;

-- ==============================================================
-- (2) TRIGGER BEFORE INSERT OR UPDATE
-- ==============================================================
DROP TRIGGER IF EXISTS enforce_active_events_quota_trigger ON public.events;

CREATE TRIGGER enforce_active_events_quota_trigger
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  WHEN (NEW.is_open = true)
  EXECUTE FUNCTION public.enforce_active_events_quota();

-- ==============================================================
-- FIM DA MIGRAÇÃO 097
-- ==============================================================
