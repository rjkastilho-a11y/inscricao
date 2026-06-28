-- ==============================================================
-- MIGRAÇÃO 032: Switch de contexto para super_admin
--
-- Permite que super_admin troque o church_id na raw_app_meta_data
-- para acessar o dashboard e dados de uma igreja específica.
-- O frontend chama set_active_church + refreshSession().
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

  UPDATE auth.users
  SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('church_id', p_church_id)
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_church TO authenticated;

-- ==============================================================
-- FIM DA MIGRAÇÃO 032
-- ==============================================================
