-- ==============================================================
-- MIGRAÇÃO 044: Scale hardening — materialized view, search, form fields
--
-- 1. Materialized view v_dashboard_stats para dashboard instantâneo
-- 2. Índice pg_trgm para busca por nome sem full scan
-- 3. Restrição de event_form_fields por church_id
-- ==============================================================

-- ==============================================================
-- (1) MATERIALIZED VIEW: v_dashboard_stats
--
-- Pré-calcula KPIs por igreja. Refresh a cada 5 minutos via cron.
-- Elimina a necessidade de scan em registrations/events a cada load.
-- ==============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.v_dashboard_stats AS
SELECT
  e.church_id,
  e.id AS event_id,
  e.title,
  e.is_open,
  e.start_date,
  e.price,
  e.max_capacity,
  COUNT(r.id) AS total_registrations,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'paid') AS paid_count,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'pending') AS pending_count,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'refunded') AS refunded_count,
  COALESCE(SUM(r.paid_amount) FILTER (WHERE r.payment_status = 'paid'), 0) AS actual_revenue,
  COALESCE(SUM(e.price) FILTER (WHERE r.payment_status = 'paid'), 0) AS expected_revenue
FROM public.events e
LEFT JOIN public.registrations r ON r.event_id = e.id AND r.deleted_at IS NULL
WHERE e.deleted_at IS NULL
GROUP BY e.church_id, e.id, e.title, e.is_open, e.start_date, e.price, e.max_capacity;

-- Índice único para CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_dashboard_stats_event
  ON public.v_dashboard_stats (event_id);

-- Índice para queries por church_id
CREATE INDEX IF NOT EXISTS idx_v_dashboard_stats_church
  ON public.v_dashboard_stats (church_id);

-- Função para refresh do materialized view
CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_dashboard_stats;
END;
$$;

-- Agendar refresh a cada 5 minutos
SELECT cron.schedule(
  'refresh-dashboard-stats',
  '*/5 * * * *',
  $$SELECT public.refresh_dashboard_stats()$$
);

-- ==============================================================
-- (2) FULL-TEXT SEARCH com pg_trgm
--
-- Adiciona índice trigram para busca por nome/email sem full scan.
-- Suporta fuzzy matching (tolerante a typos).
-- ==============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice trigram para registrations.full_name
CREATE INDEX IF NOT EXISTS idx_registrations_name_trgm
  ON public.registrations
  USING gin (full_name gin_trgm_ops);

-- Índice trigram para registrations.email
CREATE INDEX IF NOT EXISTS idx_registrations_email_trgm
  ON public.registrations
  USING gin (email gin_trgm_ops);

-- ==============================================================
-- (3) RESTRINGIR event_form_fields SELECT por church_id
--
-- Substitui USING (true) por filtragem por church_id.
-- Campos default (event_id IS NULL) continuam públicos.
-- Campos de evento específico são visíveis apenas para a igreja.
-- ==============================================================

DROP POLICY IF EXISTS "fields_public_read" ON public.event_form_fields;

-- Anônimo: só vê campos default (event_id IS NULL)
CREATE POLICY "fields_anon_read" ON public.event_form_fields
  FOR SELECT
  TO anon
  USING (event_id IS NULL);

-- Autenticado: vê campos default + campos da sua igreja
CREATE POLICY "fields_church_read" ON public.event_form_fields
  FOR SELECT
  TO authenticated
  USING (
    event_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_form_fields.event_id
        AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
    )
  );

-- ==============================================================
-- FIM DA MIGRAÇÃO 044
-- ==============================================================
