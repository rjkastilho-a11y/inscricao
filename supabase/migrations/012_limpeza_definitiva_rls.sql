-- 1. A Grande Faxina (Destruição de regras sobrepostas legadas)
DROP POLICY IF EXISTS "events_church_select" ON public.events;
DROP POLICY IF EXISTS "events_delete_admin" ON public.events;
DROP POLICY IF EXISTS "events_church_insert" ON public.events;
DROP POLICY IF EXISTS "events_church_update" ON public.events;
DROP POLICY IF EXISTS "events_church_delete" ON public.events;
DROP POLICY IF EXISTS "events_public_select" ON public.events;
DROP POLICY IF EXISTS "events_read_public" ON public.events;
DROP POLICY IF EXISTS "events_read_admin" ON public.events;
DROP POLICY IF EXISTS "events_insert_admin" ON public.events;
DROP POLICY IF EXISTS "events_update_admin" ON public.events;
DROP POLICY IF EXISTS "events_super_admin_all" ON public.events;
DROP POLICY IF EXISTS "isolar_eventos_por_igreja" ON public.events;

-- 2. RECONSTRUÇÃO: A Lei do Inquilino (Painel Interno)
CREATE POLICY "isolar_eventos_por_igreja" ON public.events
  FOR ALL
  TO authenticated
  USING (
    church_id IN (SELECT church_id FROM public.user_roles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    church_id IN (SELECT church_id FROM public.user_roles WHERE user_id = auth.uid())
  );

-- 3. RECONSTRUÇÃO: A Lei do Visitante (Landing Page)
CREATE POLICY "permitir_leitura_publica_anonima" ON public.events
  FOR SELECT
  TO anon
  USING (is_open = true);
