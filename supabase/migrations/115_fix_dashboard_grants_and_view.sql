-- 115_fix_dashboard_grants_and_view.sql
-- Fix: GRANT EXECUTE on RPC + add refunded_count / expected_revenue to view

-- 1) Grant EXECUTE on the SECURITY DEFINER function so authenticated role can call it
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID) TO anon;

-- 2) Recreate view with the two missing columns
--    Must DROP first: PG cannot add/rename columns via CREATE OR REPLACE VIEW
DROP VIEW IF EXISTS public.v_dashboard_per_event;

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
  COUNT(r.id)                                                              AS total_registrations,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'paid')                    AS paid_count,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'pending')                 AS pending_count,
  COUNT(r.id) FILTER (WHERE r.payment_status = 'refunded')                AS refunded_count,
  COALESCE(SUM(COALESCE(el.price, e.price))
    FILTER (WHERE r.payment_status = 'paid'), 0)                           AS revenue,
  COALESCE(SUM(COALESCE(el.price, e.price))
    FILTER (WHERE r.payment_status IN ('paid','pending')), 0)              AS expected_revenue
FROM public.events e
LEFT JOIN public.registrations r ON r.event_id = e.id
LEFT JOIN public.event_lots el ON el.id = r.lot_id
GROUP BY e.id, e.title, e.slug, e.is_open, e.start_date, e.price, e.max_capacity
ORDER BY e.start_date DESC;
