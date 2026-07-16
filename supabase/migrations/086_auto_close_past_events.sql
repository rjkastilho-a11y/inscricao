-- ==============================================================
-- MIGRAÇÃO 086: Fechar automaticamente eventos encerrados
-- 1. Corrige dados existentes (eventos passados continuavam abertos)
-- 2. Cria trigger para fechar automaticamente no futuro
-- ==============================================================

-- 1. Fechar eventos cuja end_date já passou
UPDATE public.events
SET is_open = false,
    updated_at = now()
WHERE is_open = true
  AND end_date IS NOT NULL
  AND end_date < now();

-- 2. Função para fechar automaticamente ao inserir/atualizar
CREATE OR REPLACE FUNCTION public.auto_close_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_date IS NOT NULL AND NEW.end_date <= now() AND NEW.is_open = true THEN
    NEW.is_open := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger que roda antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS trg_auto_close_event ON public.events;
CREATE TRIGGER trg_auto_close_event
  BEFORE INSERT OR UPDATE OF is_open, end_date ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_close_event();

-- 4. Log
DO $$
DECLARE
  v_fechados INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_fechados FROM public.events
  WHERE is_open = false
    AND end_date IS NOT NULL
    AND end_date < now()
    AND updated_at = now();

  RAISE NOTICE 'Eventos fechados automaticamente: %', v_fechados;
END $$;
