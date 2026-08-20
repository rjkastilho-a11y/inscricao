-- 121_hotfix_dashboard_real_revenue_syntax.sql
-- Fix: missing FROM-clause entry for table "r"
-- The alias r.paid_amount was used in SELECT FROM reg, where r doesn't exist as a separate alias
-- Solution: aggregate into reg_agg CTE first, then reference reg_agg.revenue_reg

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
    SELECT r.event_id, r.payment_status, r.paid_amount
    FROM public.registrations r
    JOIN ev e ON e.id = r.event_id
    WHERE r.deleted_at IS NULL
      AND (v_is_super OR r.church_id = v_church_id)
  ),
  reg_agg AS (
    SELECT
      COUNT(*) AS total_reg,
      COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_reg,
      COUNT(*) FILTER (WHERE payment_status = 'pending') AS pending_reg,
      COALESCE(SUM(COALESCE(paid_amount, 0)) FILTER (WHERE payment_status != 'canceled'), 0) AS revenue_reg
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
