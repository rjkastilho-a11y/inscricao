-- ==============================================================
-- MIGRAÇÃO 034: Hardening de segurança — groups + invites
--
-- 1. groups_church_insert: adiciona role check (admin/super_admin)
-- 2. invites_public_validate: restringe a eventos abertos
-- ==============================================================

-- ==============================================================
-- (1) groups_church_insert — exigir role admin ou super_admin
-- ==============================================================

DROP POLICY IF EXISTS "groups_church_insert" ON public.group_assignments;

CREATE POLICY "groups_church_insert" ON public.group_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'church_role') IN ('admin', 'super_admin')
    AND event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

-- ==============================================================
-- (2) invites_public_validate — restringir a eventos abertos
-- ==============================================================

DROP POLICY IF EXISTS "invites_public_validate" ON public.event_invites;

CREATE POLICY "invites_public_validate" ON public.event_invites
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_invites.event_id
        AND e.is_open = true
    )
  );

-- ==============================================================
-- FIM DA MIGRAÇÃO 034
-- ==============================================================
