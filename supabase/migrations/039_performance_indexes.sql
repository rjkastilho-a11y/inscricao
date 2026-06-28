-- ==============================================================
-- MIGRAÇÃO 039: Índices B-Tree para performance em escala
--
-- Otimiza queries RLS que filtram por church_id.
-- Essencial para 500+ igrejas com milhares de registros.
-- ==============================================================

-- events: filtro principal do RLS
CREATE INDEX IF NOT EXISTS idx_events_church_id
  ON public.events (church_id);

-- events: compound index para queries públicas (is_open + church_id)
CREATE INDEX IF NOT EXISTS idx_events_church_open
  ON public.events (church_id, is_open);

-- registrations: filtro RLS + trial limit
CREATE INDEX IF NOT EXISTS idx_registrations_church_id
  ON public.registrations (church_id);

-- registrations: lookup por event_id (JOINs com events)
CREATE INDEX IF NOT EXISTS idx_registrations_event_id
  ON public.registrations (event_id);

-- financial_entries: filtro RLS
CREATE INDEX IF NOT EXISTS idx_financial_church_id
  ON public.financial_entries (church_id);

-- financial_entries: lookup por event_id
CREATE INDEX IF NOT EXISTS idx_financial_event_id
  ON public.financial_entries (event_id);

-- group_assignments: lookup por event_id (já existe idx no event_id via FK, mas garante)
CREATE INDEX IF NOT EXISTS idx_groups_event_id
  ON public.group_assignments (event_id);

-- churches: lookup por status (para queries de admin)
CREATE INDEX IF NOT EXISTS idx_churches_status
  ON public.churches (status);

-- user_roles: compound index para lookup por user + church
-- (já existe idx_user_roles_user_church da migração 030)

-- ==============================================================
-- FIM DA MIGRAÇÃO 039
-- ==============================================================
