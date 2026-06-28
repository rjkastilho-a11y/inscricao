-- ==============================================================
-- MIGRAÇÃO 033: Corrige sync_user_jwt_claims para super_admin
--
-- PROBLEMA: sync_user_jwt_claims pega a role mais alta. Se for
-- super_admin (church_id=NULL), a JWT fica com church_id=NULL.
-- Isso bloqueia RLS em business tables e ChurchGuard sem contexto.
--
-- SOLUÇÃO: Se a role mais alta for super_admin e church_id for
-- NULL, buscar o church_id da primeira role 'admin' do usuário.
-- ==============================================================

CREATE OR REPLACE FUNCTION public.sync_user_jwt_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id  UUID;
  v_church_id  UUID;
  v_role       user_role_enum;
BEGIN
  v_target_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Se o usuário perdeu todas as roles (DELETE), limpa os claims
  IF TG_OP = 'DELETE' THEN
    UPDATE auth.users
    SET raw_app_meta_data =
          raw_app_meta_data - 'church_id' - 'church_role'
    WHERE id = v_target_id;
    RETURN OLD;
  END IF;

  -- Pega a role mais alta do usuário (super_admin > admin > moderator > user)
  SELECT church_id, role INTO v_church_id, v_role
  FROM public.user_roles
  WHERE user_id = v_target_id
  ORDER BY
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin'      THEN 2
      WHEN 'moderator'  THEN 3
      WHEN 'user'       THEN 4
    END
  LIMIT 1;

  -- Se for super_admin sem church_id, tenta pegar a primeira
  -- igreja onde o usuário é admin (fallback para contexto inicial)
  IF v_role = 'super_admin' AND v_church_id IS NULL THEN
    SELECT church_id INTO v_church_id
    FROM public.user_roles
    WHERE user_id = v_target_id
      AND role = 'admin'
      AND church_id IS NOT NULL
    LIMIT 1;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::jsonb) ||
        jsonb_build_object(
          'church_id', v_church_id,
          'church_role', v_role
        )
  WHERE id = v_target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Backfill: atualiza JWT de todos os usuários existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ur.user_id,
           FIRST_VALUE(ur.church_id) OVER w AS church_id,
           FIRST_VALUE(ur.role) OVER w AS role
    FROM public.user_roles ur
    WINDOW w AS (PARTITION BY ur.user_id
                 ORDER BY CASE ur.role
                   WHEN 'super_admin' THEN 1
                   WHEN 'admin'      THEN 2
                   WHEN 'moderator'  THEN 3
                   WHEN 'user'       THEN 4
                 END)
  LOOP
    -- Se for super_admin sem church_id, busca do admin
    IF r.role = 'super_admin' AND r.church_id IS NULL THEN
      SELECT church_id INTO r.church_id
      FROM public.user_roles
      WHERE user_id = r.user_id
        AND role = 'admin'
        AND church_id IS NOT NULL
      LIMIT 1;
    END IF;

    UPDATE auth.users
    SET raw_app_meta_data =
          COALESCE(raw_app_meta_data, '{}'::jsonb) ||
          jsonb_build_object('church_id', r.church_id, 'church_role', r.role)
    WHERE id = r.user_id;
  END LOOP;
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 033
-- ==============================================================
