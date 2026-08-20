-- 122_unify_financial_rules.sql
-- Unify revenue calculation: FinancialPage JS → SQL (RPC + VIEW)
-- Rules (from FinancialPage.tsx lines 144-149):
--   1. Include if: status = 'paid' OR (paid_amount IS NOT NULL AND paid_amount > 0)
--   2. Value: paid_amount if > 0, else fallback to effective_price (lot/event price)
--   3. Exclude: canceled (query level), cortesia not in filter

-- ============================================================
-- 1) VIEW v_dashboard_per_event — revenue + expected_revenue
-- ============================================================
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
  SUM(
    CASE
      WHEN r.paid_amount IS NOT NULL AND r.paid_amount > 0 THEN r.paid_amount
      ELSE COALESCE(el.price, e.price)
    END
  ) FILTER (
    WHERE r.payment_status = 'paid'
       OR (r.paid_amount IS NOT NULL AND r.paid_amount > 0)
  )                                                                       AS revenue,
  SUM(COALESCE(el.price, e.price))
    FILTER (WHERE r.payment_status != 'canceled'
                AND r.payment_status != 'cortesia')                       AS expected_revenue
FROM public.events e
LEFT JOIN public.registrations r ON r.event_id = e.id
LEFT JOIN public.event_lots el ON el.id = r.lot_id
GROUP BY e.id, e.title, e.slug, e.is_open, e.start_date, e.price, e.max_capacity
ORDER BY e.start_date DESC;

GRANT SELECT ON public.v_dashboard_per_event TO authenticated;
GRANT SELECT ON public.v_dashboard_per_event TO anon;

-- ============================================================
-- 2) RPC get_dashboard_kpis — reg_agg with paid_amount fallback
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_events          BIGINT,
  open_events           BIGINT,
  total_registrations   BIGINT,
  paid_registrations    BIGINT,
  pending_registrations BIGINT,
  total_revenue         DECIMAL,
  total_offerings       DECIMAL,
  total_expenses        DECIMAL,
  total_income          DECIMAL,
  balance               DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_super   BOOLEAN;
  v_church_id  UUID;
BEGIN
  v_is_super  := (auth.jwt() -> 'app_metadata' ->> 'church_role') = 'super_admin';
  v_church_id := (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid;

  RETURN QUERY
  WITH
  ev AS (
    SELECT e.id, e.price, e.is_open
    FROM public.events e
    WHERE e.deleted_at IS NULL
      AND (v_is_super OR e.church_id = v_church_id)
      AND (p_event_id IS NULL OR e.id = p_event_id)
  ),
  reg AS (
    SELECT r.event_id, r.payment_status, r.paid_amount,
           COALESCE(el.price, e.price) AS effective_price
    FROM public.registrations r
    JOIN ev e ON e.id = r.event_id
    LEFT JOIN public.event_lots el ON el.id = r.lot_id
    WHERE r.deleted_at IS NULL
      AND (v_is_super OR r.church_id = v_church_id)
  ),
  reg_agg AS (
    SELECT
      COUNT(*) AS total_reg,
      COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_reg,
      COUNT(*) FILTER (WHERE payment_status = 'pending') AS pending_reg,
      SUM(
        CASE
          WHEN paid_amount IS NOT NULL AND paid_amount > 0 THEN paid_amount
          ELSE effective_price
        END
      ) FILTER (
        WHERE payment_status = 'paid'
           OR (paid_amount IS NOT NULL AND paid_amount > 0)
      ) AS revenue_reg
    FROM reg
  ),
  off AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.financial_entries fe
    WHERE fe.type = 'income'
      AND fe.category != 'registration'
      AND EXISTS (SELECT 1 FROM ev e WHERE e.id = fe.event_id)
      AND (p_event_id IS NULL OR fe.event_id = p_event_id)
  ),
  exp AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.financial_entries fe
    WHERE fe.type = 'expense'
      AND EXISTS (SELECT 1 FROM ev e WHERE e.id = fe.event_id)
      AND (p_event_id IS NULL OR fe.event_id = p_event_id)
  )
  SELECT
    (SELECT COUNT(*) FROM ev),
    (SELECT COUNT(*) FROM public.events
     WHERE deleted_at IS NULL
       AND is_open = true
       AND (v_is_super OR church_id = v_church_id)
       AND (p_event_id IS NULL OR id = p_event_id)),
    reg_agg.total_reg,
    reg_agg.paid_reg,
    reg_agg.pending_reg,
    reg_agg.revenue_reg,
    (SELECT total FROM off),
    (SELECT total FROM exp),
    reg_agg.revenue_reg + (SELECT total FROM off),
    reg_agg.revenue_reg + (SELECT total FROM off) - (SELECT total FROM exp)
  FROM reg_agg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID) TO anon;
