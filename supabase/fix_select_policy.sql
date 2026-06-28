-- =============================================
-- CORREÇÃO COMPLETA: Permissões para inscrições aparecerem no painel
-- Execute no SQL Editor do Supabase Dashboard
-- =============================================

-- 1. GRANTs: acesso básico às tabelas
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 2. Remove TODAS as policies existentes de registrations e events
DO $$ BEGIN
  DROP POLICY IF EXISTS "registrations_admin_all" ON public.registrations;
  DROP POLICY IF EXISTS "registrations_public_insert" ON public.registrations;
  DROP POLICY IF EXISTS "registrations_select_auth" ON public.registrations;
  DROP POLICY IF EXISTS "events_select_auth" ON public.events;
  DROP POLICY IF EXISTS "events_public_read" ON public.events;
  DROP POLICY IF EXISTS "events_admin_read" ON public.events;
  DROP POLICY IF EXISTS "events_admin_write" ON public.events;
  DROP POLICY IF EXISTS "events_admin_all" ON public.events;
END $$;

-- 3. REGISTRATIONS: policies
CREATE POLICY "registrations_admin_all" ON public.registrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "registrations_public_insert" ON public.registrations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND is_open = true
    )
  );

CREATE POLICY "registrations_select_auth" ON public.registrations
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. EVENTS: policies
CREATE POLICY "events_select_auth" ON public.events
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "events_admin_all" ON public.events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "events_public_read" ON public.events
  FOR SELECT
  USING (is_open = true);
