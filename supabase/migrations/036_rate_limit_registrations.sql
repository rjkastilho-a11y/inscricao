-- ==============================================================
-- MIGRAÇÃO 036: Rate limit para inscrições públicas
--
-- Limita a 5 inscrições por e-mail a cada 10 minutos.
-- Previne abuso da política registrations_public_insert.
-- ==============================================================

CREATE OR REPLACE FUNCTION public.check_registration_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.registrations
  WHERE LOWER(email) = LOWER(NEW.email)
    AND created_at > now() - INTERVAL '10 minutes';

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 inscrições a cada 10 minutos atingido. Tente novamente mais tarde.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrations_rate_limit ON public.registrations;
CREATE TRIGGER trg_registrations_rate_limit
  BEFORE INSERT ON public.registrations
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION public.check_registration_rate_limit();

-- ==============================================================
-- FIM DA MIGRAÇÃO 036
-- ==============================================================
