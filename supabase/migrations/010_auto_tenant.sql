-- ==============================================================
-- MIGRATION 010: Auto-tenant — cria igreja + admin no signup
-- Idempotente: pode rodar múltiplas vezes sem efeito colateral
-- ==============================================================

-- ==============================================================
-- (1) FUNÇÃO DISPARADA NO AFTER INSERT DE auth.users
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
  -- Extrai o nome da igreja dos metadados enviados no signUp
  v_church_name := NEW.raw_user_meta_data->>'church_name';

  -- Fallback: se não veio, usa o nome da pessoa ou o e-mail
  IF v_church_name IS NULL OR v_church_name = '' THEN
    v_church_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  END IF;

  -- Cria o tenant (igreja) em status trial
  INSERT INTO public.churches (name, status)
  VALUES (v_church_name, 'trial')
  RETURNING id INTO v_church_id;

  -- Vincula o dono como admin da igreja
  INSERT INTO public.user_roles (user_id, role, church_id)
  VALUES (NEW.id, 'admin', v_church_id);

  RETURN NEW;
END;
$$;

-- ==============================================================
-- (2) TRIGGER NO auth.users
-- ==============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================
-- FIM DA MIGRAÇÃO 010
-- ==============================================================
