-- ==============================================================
-- MIGRAÇÃO 090: Corrigir datas de evento/lote (TIMESTAMPTZ → DATE)
-- Datas de início/fim são apenas datas (sem horário). O tipo
-- TIMESTAMPTZ causava deslocamento de 1 dia em fusos negativos
-- (ex.: Brasil, UTC-3) porque a data era armazenada como meia-noite
-- UTC e reexibida convertida para o fuso local.
--
-- Idempotente: pode ser reexecutada sem erro. Se aplicada pelo
-- SQL Editor, rode em partes (1 → 2 → 3), uma pasta por vez.
-- ==============================================================

-- ==============================================================
-- PARTE 1 — Remover dependências
-- ==============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-dashboard-stats') THEN
    PERFORM cron.unschedule('refresh-dashboard-stats');
  END IF;
END $$;

DROP MATERIALIZED VIEW IF EXISTS public.v_dashboard_stats;
DROP VIEW IF EXISTS public.v_dashboard_per_event;
DROP TRIGGER IF EXISTS trg_auto_close_event ON public.events;

-- ==============================================================
-- PARTE 2 — Alterar os tipos
-- Dados existentes são meia-noite UTC; a conversão ::date preserva o dia correto
-- ==============================================================
SET timezone = 'UTC';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
      AND column_name = 'start_date' AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE public.events
      ALTER COLUMN start_date TYPE DATE USING start_date::date,
      ALTER COLUMN end_date   TYPE DATE USING end_date::date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_lots'
      AND column_name = 'start_date' AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE public.event_lots
      ALTER COLUMN start_date TYPE DATE USING start_date::date,
      ALTER COLUMN end_date   TYPE DATE USING end_date::date;
  END IF;
END $$;

-- ==============================================================
-- PARTE 3 — Recriar views, gatilho e cron
-- ==============================================================
DROP MATERIALIZED VIEW IF EXISTS public.v_dashboard_stats;
DROP VIEW IF EXISTS public.v_dashboard_per_event;
DROP TRIGGER IF EXISTS trg_auto_close_event ON public.events;

-- Recriar materialized view v_dashboard_stats (definição de 045_final_fixes.sql)
CREATE MATERIALIZED VIEW public.v_dashboard_stats AS
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
  COALESCE(SUM(COALESCE(el.price, e.price)) FILTER (WHERE r.payment_status = 'paid'), 0) AS expected_revenue
FROM public.events e
LEFT JOIN public.registrations r ON r.event_id = e.id AND r.deleted_at IS NULL
LEFT JOIN public.event_lots el ON el.id = r.lot_id
WHERE e.deleted_at IS NULL
GROUP BY e.church_id, e.id, e.title, e.is_open, e.start_date, e.price, e.max_capacity;

CREATE UNIQUE INDEX idx_v_dashboard_stats_event
  ON public.v_dashboard_stats (event_id);

CREATE INDEX idx_v_dashboard_stats_church
  ON public.v_dashboard_stats (church_id);

-- Recriar view v_dashboard_per_event (definição de 020_fix_lot_prices.sql)
CREATE VIEW public.v_dashboard_per_event
WITH (security_invoker = true)
AS
SELECT
  e.id,
  e.title,
  e.slug,
  e.is_open,
  e.start_date,
  e.price,
  e.max_capacity,
  COUNT(r.id)                                              AS total_registrations,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'paid')    AS paid_count,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'pending') AS pending_count,
  COALESCE(SUM(COALESCE(el.price, e.price)) FILTER (WHERE r.payment_status = 'paid'), 0) AS revenue
FROM public.events e
LEFT JOIN public.registrations r ON r.event_id = e.id
LEFT JOIN public.event_lots el ON el.id = r.lot_id
GROUP BY e.id, e.title, e.slug, e.is_open, e.start_date, e.price, e.max_capacity
ORDER BY e.start_date DESC;

COMMENT ON VIEW public.v_dashboard_per_event IS 'Agregação por evento para dashboard. Usa COALESCE(lot_price, event_price) para refletir lotes promocionais.';

-- Recriar gatilho de fechamento automático (086_auto_close_past_events.sql)
CREATE TRIGGER trg_auto_close_event
  BEFORE INSERT OR UPDATE OF is_open, end_date ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_close_event();

-- Reagendar refresh a cada 5 minutos (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-dashboard-stats') THEN
    PERFORM cron.schedule('refresh-dashboard-stats', '*/5 * * * *', $cron$SELECT public.refresh_dashboard_stats()$cron$);
  END IF;
END $$;
