-- ==============================================================
-- MIGRATION 013: group_assignments — tabela + RLS
-- ==============================================================

-- ==============================================================
-- (1) CRIAR TABELA group_assignments
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.group_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  grupo_numero  INTEGER NOT NULL,
  genero        TEXT,
  monitor_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (event_id, grupo_numero)
);

-- ==============================================================
-- (2) ADICIONAR COLUNA group_assignment_id EM registrations
-- ==============================================================
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS group_assignment_id UUID REFERENCES public.group_assignments(id) ON DELETE SET NULL;

-- ==============================================================
-- (3) GRANTS
-- ==============================================================
GRANT ALL ON public.group_assignments TO anon, authenticated;

-- ==============================================================
-- (4) HABILITAR RLS
-- ==============================================================
ALTER TABLE public.group_assignments ENABLE ROW LEVEL SECURITY;

-- ==============================================================
-- (5) SUPER ADMIN BYPASS
-- ==============================================================
DROP POLICY IF EXISTS "group_assignments_super_admin_all" ON public.group_assignments;

CREATE POLICY "group_assignments_super_admin_all" ON public.group_assignments
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ==============================================================
-- (6) ISOLAMENTO POR IGREJA (via event_id → events.church_id)
-- ==============================================================
DROP POLICY IF EXISTS "group_assignments_church_select" ON public.group_assignments;
DROP POLICY IF EXISTS "group_assignments_church_insert" ON public.group_assignments;
DROP POLICY IF EXISTS "group_assignments_church_update" ON public.group_assignments;
DROP POLICY IF EXISTS "group_assignments_church_delete" ON public.group_assignments;

CREATE POLICY "group_assignments_church_select" ON public.group_assignments
  FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "group_assignments_church_insert" ON public.group_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "group_assignments_church_update" ON public.group_assignments
  FOR UPDATE
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_roles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "group_assignments_church_delete" ON public.group_assignments
  FOR DELETE
  TO authenticated
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id IN (SELECT church_id FROM public.user_roles WHERE user_id = auth.uid())
    )
  );

-- ==============================================================
-- FIM DA MIGRAÇÃO 013
-- ==============================================================
