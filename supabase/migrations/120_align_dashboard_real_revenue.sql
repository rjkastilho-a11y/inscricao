-- 120_align_dashboard_real_revenue.sql
-- Fix: align Dashboard "Receita Real" with Financial page
-- Use paid_amount (actual payment) instead of effective_price (lot/event price)
-- Filter non-canceled registrations instead of only 'paid'

-- ============================================================
-- 1) get_dashboard_kpis — revenue from paid_amount, not effective_price
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
    COUNT(*),
    COUNT(*) FILTER (WHERE payment_status = 'paid'),
    COUNT(*) FILTER (WHERE payment_status = 'pending'),
    COALESCE(SUM(COALESCE(r.paid_amount, 0)) FILTER (WHERE payment_status != 'canceled'), 0),
    (SELECT off.total FROM off),
    (SELECT exp.total FROM exp),
    COALESCE(SUM(COALESCE(r.paid_amount, 0)) FILTER (WHERE payment_status != 'canceled'), 0) + (SELECT off.total FROM off),
    COALESCE(SUM(COALESCE(r.paid_amount, 0)) FILTER (WHERE payment_status != 'canceled'), 0) + (SELECT off.total FROM off) - (SELECT exp.total FROM exp)
  FROM reg;
END;
$$;

-- ============================================================
-- 2) GRANTs
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID) TO anon;
