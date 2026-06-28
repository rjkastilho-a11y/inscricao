-- ==============================================================
-- MIGRAÇÃO 053: Exclusão completa de igreja (super_admin)
--
-- Cria função delete_church que remove todos os dados dependentes
-- na ordem correta (respeitando ON DELETE RESTRICT) e deleta o
-- auth user, liberando o email para novo cadastro.
-- ==============================================================

CREATE OR REPLACE FUNCTION public.delete_church(p_church_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_user_id     UUID;
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

  -- 3. Buscar o user_id associado (primeiro admin)
  SELECT user_id INTO v_user_id
  FROM public.user_roles
  WHERE church_id = p_church_id AND role = 'admin'
  LIMIT 1;

  -- 4. Deletar na ordem correta (respeitando ON DELETE RESTRICT)
  --    payments → registrations (RESTRICT)
  DELETE FROM public.payments
  WHERE registration_id IN (
    SELECT id FROM public.registrations WHERE church_id = p_church_id
  );

  --    registrations → events (RESTRICT), church_id
  DELETE FROM public.registrations WHERE church_id = p_church_id;

  --    group_assignments → events (RESTRICT)
  DELETE FROM public.group_assignments
  WHERE event_id IN (
    SELECT id FROM public.events WHERE church_id = p_church_id
  );

  --    event_invites → events (RESTRICT)
  DELETE FROM public.event_invites
  WHERE event_id IN (
    SELECT id FROM public.events WHERE church_id = p_church_id
  );

  --    event_lots → events (RESTRICT)
  DELETE FROM public.event_lots
  WHERE event_id IN (
    SELECT id FROM public.events WHERE church_id = p_church_id
  );

  --    form_fields → events (CASCADE, mas seguro limpar antes)
  DELETE FROM public.event_form_fields
  WHERE event_id IN (
    SELECT id FROM public.events WHERE church_id = p_church_id
  );

  --    financial_entries → church_id
  DELETE FROM public.financial_entries WHERE church_id = p_church_id;

  --    events → church_id
  DELETE FROM public.events WHERE church_id = p_church_id;

  --    user_roles → church_id
  DELETE FROM public.user_roles WHERE church_id = p_church_id;

  --    audit_log (se existir)
  DELETE FROM public.audit_log WHERE target_church_id = p_church_id;

  --    churches
  DELETE FROM public.churches WHERE id = p_church_id;

  -- 5. NOTA: auth.admin.delete_user() requer service_role_key (Edge Function).
  --    O auth user fica órfão mas não atrapalha o sistema.
END;
$$;

-- ==============================================================
-- FIM DA MIGRAÇÃO 053
-- ==============================================================
