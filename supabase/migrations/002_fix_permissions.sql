-- =============================================
-- CORREÇÃO: Garantir permissões para anon/authenticated
-- =============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

-- =============================================
-- CORREÇÃO: Recriar políticas RLS para registrations
-- (usando WITH CHECK explícito para INSERT)
-- =============================================
DROP POLICY IF EXISTS "registrations_admin_all" ON public.registrations;
DROP POLICY IF EXISTS "registrations_public_insert" ON public.registrations;

CREATE POLICY "registrations_admin_all" ON public.registrations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "registrations_public_insert" ON public.registrations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND is_open = true
    )
  );

-- =============================================
-- CORREÇÃO: Garantir que user_roles tenha RLS correta
-- =============================================
DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;

CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Permite que user_roles seja lida pelo SECURITY DEFINER has_role
-- mesmo quando RLS está habilitado (o SECURITY DEFINER já faz isso,
-- mas garantimos que a role anon/authenticated tem acesso)
GRANT ALL ON public.user_roles TO anon, authenticated;
