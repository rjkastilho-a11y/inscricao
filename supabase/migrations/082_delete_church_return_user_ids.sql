-- ==============================================================
-- MIGRAÇÃO 082: delete_church retorna user_ids para limpeza do auth
--
-- Modifica delete_church para retornar os user_ids dos admins
-- deletados, permitindo que o frontend chame uma Edge/Netlify
-- Function com service_role_key para excluir os auth.users.
-- ==============================================================

DROP FUNCTION IF EXISTS public.delete_church(UUID);

CREATE OR REPLACE FUNCTION public.delete_church(p_church_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_user_ids    UUID[];
BEGIN
  -- 1. Verificar super_admin
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'church_role';
  IF v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Apenas super_admin pode excluir igrejas';
  END IF;

  -- 2. Verificar se igreja existe
  IF NOT EXISTS (
    SELECT 1 FROM public.churches WHERE id = p_church_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Igreja não encontrada';
  END IF;

  -- 3. Coletar user_ids antes de deletar
  SELECT ARRAY_AGG(user_id) INTO v_user_ids
  FROM public.user_roles
  WHERE church_id = p_church_id;

  -- 4. Deletar na ordem correta (respeitando ON DELETE RESTRICT)
  DELETE FROM public.payments
  WHERE registration_id IN (
    SELECT id FROM public.registrations WHERE church_id = p_church_id
  );

  DELETE FROM public.registrations WHERE church_id = p_church_id;

  DELETE FROM public.group_assignments
  WHERE event_id IN (
    SELECT id FROM public.events WHERE church_id = p_church_id
  );

  DELETE FROM public.event_invites
  WHERE event_id IN (
    SELECT id FROM public.events WHERE church_id = p_church_id
  );

  DELETE FROM public.event_lots
  WHERE event_id IN (
    SELECT id FROM public.events WHERE church_id = p_church_id
  );

  DELETE FROM public.event_form_fields
  WHERE event_id IN (
    SELECT id FROM public.events WHERE church_id = p_church_id
  );

  DELETE FROM public.financial_entries WHERE church_id = p_church_id;

  DELETE FROM public.events WHERE church_id = p_church_id;

  DELETE FROM public.user_roles WHERE church_id = p_church_id;

  DELETE FROM public.audit_log WHERE target_church_id = p_church_id;

  DELETE FROM public.churches WHERE id = p_church_id;

  -- 5. Retornar user_ids para o frontend limpar o auth posteriormente
  RETURN v_user_ids;
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 082
-- ==============================================================
