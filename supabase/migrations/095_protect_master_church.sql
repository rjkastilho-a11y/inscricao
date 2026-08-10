-- ==============================================================
-- MIGRATION 095: Trava anti-self-lockout no delete_church
--
-- Impede a exclusão da conta Master (e-mail via public.master_email()).
-- Sem isso, excluir a igreja da conta Master apagaria os user_roles
-- vinculados (inclusive o role 'admin' do master), o trigger
-- sync_user_jwt_claims limparia o church_id/church_role do JWT e a
-- conta perderia o contexto de igreja (self-lockout).
-- ==============================================================

CREATE OR REPLACE FUNCTION public.delete_church(p_church_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_owner_email TEXT;
  v_user_ids    UUID[];
BEGIN
  -- 1. Verificar super_admin
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'church_role';
  IF v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Apenas super_admin pode excluir igrejas';
  END IF;

  -- 2. Verificar se a igreja existe
  IF NOT EXISTS (
    SELECT 1 FROM public.churches WHERE id = p_church_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Igreja não encontrada';
  END IF;

  -- 3. TRAVA ANTI-SELF-LOCKOUT
  --    Identifica o e-mail do dono da igreja com a MESMA lógica de
  --    get_first_admin_email (evita divergência entre UI e backend)
  SELECT u.email::text INTO v_owner_email
  FROM auth.users u
  JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE ur.church_id = p_church_id
    AND ur.role IN ('admin', 'super_admin')
  LIMIT 1;

  IF v_owner_email IS NOT NULL AND lower(v_owner_email) = lower(public.master_email()) THEN
    RAISE EXCEPTION 'A conta Master do sistema não pode ser excluída.';
  END IF;

  -- 4. Coletar user_ids antes de deletar (para limpeza do auth no frontend)
  SELECT ARRAY_AGG(user_id) INTO v_user_ids
  FROM public.user_roles
  WHERE church_id = p_church_id;

  -- 5. Deletar na ordem correta (respeitando ON DELETE RESTRICT)
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

  -- 6. Retornar user_ids para o frontend limpar o auth posteriormente
  RETURN v_user_ids;
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 095
-- ==============================================================
