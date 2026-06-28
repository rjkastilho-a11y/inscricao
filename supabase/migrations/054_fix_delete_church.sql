-- ==============================================================
-- MIGRAÇÃO 054: Corrigir delete_church (remover auth.admin.delete_user)
--
-- auth.admin.delete_user() requer service_role_key (Edge Function).
-- Chamada via SQL comum retorna erro:
-- "cross-database references are not implemented: auth.admin.delete_user"
-- ==============================================================

CREATE OR REPLACE FUNCTION public.delete_church(p_church_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
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

  -- 3. Deletar na ordem correta (respeitando ON DELETE RESTRICT)
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

  -- 4. NOTA: auth.admin.delete_user() requer service_role_key (Edge Function).
  --    O auth user fica órfão mas não atrapalha o sistema.
  --    Para liberar o email, crie uma Edge Function com service_role_key.
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 054
-- ==============================================================
