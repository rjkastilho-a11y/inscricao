-- ==============================================================
-- MIGRAÇÃO 089: Google OAuth — suporte a login social
--
-- 1. Modifica handle_new_user() para NÃO criar igreja para OAuth
-- 2. Cria complete_oauth_onboarding() para onboarding pós-OAuth
-- ================================================= ==============================================================

-- ==============================================================
-- (1) MODIFICAR handle_new_user() — detectar OAuth
--
-- Usuários criados via Google OAuth NÃO devem ter igreja
-- criada automaticamente. Eles completam onboarding via /onboarding.
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
  v_is_oauth    BOOLEAN;
BEGIN
  -- Detectar se é OAuth: verificar se existe identity com provider != 'email'
  -- Na tabela auth.identities, usuários email/senha têm provider = 'email'
  -- Usuários Google têm provider = 'google'
  SELECT EXISTS (
    SELECT 1 FROM auth.identities
    WHERE user_id = NEW.id AND provider != 'email'
  ) INTO v_is_oauth;

  -- Usuários OAuth: NÃO criar igreja automaticamente.
  -- Eles completam onboarding via /onboarding no frontend.
  IF v_is_oauth THEN
    RETURN NEW;
  END IF;

  -- Fluxo original: email/senha cria igreja + admin
  v_church_name := NEW.raw_user_meta_data->>'church_name';

  IF v_church_name IS NULL OR v_church_name = '' THEN
    v_church_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    );
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
-- (2) FUNÇÃO: complete_oauth_onboarding
--
-- Chamada pelo frontend após OAuth quando usuário não tem igreja.
-- Cria church + user_roles para o usuário autenticado.
-- ==============================================================

CREATE OR REPLACE FUNCTION public.complete_oauth_onboarding(
  p_church_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id           UUID;
  v_church_id         UUID;
  v_church_name_clean TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Verificar se já completou onboarding (tem user_roles)
  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Onboarding já foi completado';
  END IF;

  -- Limpar e validar nome da igreja
  v_church_name_clean := trim(p_church_name);
  IF v_church_name_clean = '' THEN
    RAISE EXCEPTION 'Nome da igreja é obrigatório';
  END IF;

  -- Criar igreja em trial (14 dias)
  INSERT INTO public.churches (name, status, trial_ends_at)
  VALUES (v_church_name_clean, 'trial', now() + INTERVAL '14 days')
  RETURNING id INTO v_church_id;

  -- Vincular usuário como admin da igreja
  INSERT INTO public.user_roles (user_id, role, church_id)
  VALUES (v_user_id, 'admin', v_church_id);

  -- sync_user_jwt_claims dispara automaticamente via trigger em user_roles

  RETURN jsonb_build_object(
    'church_id',   v_church_id,
    'church_name', v_church_name_clean
  );
END;
$$;

-- Permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION public.complete_oauth_onboarding TO authenticated;

-- ==============================================================
-- FIM DA MIGRAÇÃO 089
-- ==============================================================
