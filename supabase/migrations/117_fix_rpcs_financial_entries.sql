-- 117_fix_rpcs_financial_entries.sql
-- Fix: replace ghost table references (offerings/expenses) with real table (financial_entries)

-- ============================================================
-- 1) get_dashboard_kpis — CTEs off/exp now query financial_entries
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
    SELECT r.event_id, r.payment_status,
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
    COALESCE(SUM(effective_price) FILTER (WHERE payment_status = 'paid'), 0),
    off.total,
    exp.total,
    COALESCE(SUM(effective_price) FILTER (WHERE payment_status = 'paid'), 0) + off.total,
    COALESCE(SUM(effective_price) FILTER (WHERE payment_status = 'paid'), 0) + off.total - exp.total
  FROM reg, off, exp;
END;
$$;

-- ============================================================
-- 2) get_financial_summary — same fix for off/exp CTEs
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_financial_summary(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  income_registrations DECIMAL,
  income_offerings     DECIMAL,
  total_income         DECIMAL,
  total_expenses       DECIMAL,
  balance              DECIMAL
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
  paid_reg AS (
    SELECT COALESCE(SUM(COALESCE(el.price, ev.price)), 0) AS total
    FROM public.registrations r
    JOIN public.events ev ON ev.id = r.event_id
    LEFT JOIN public.event_lots el ON el.id = r.lot_id
    WHERE r.payment_status = 'paid'
      AND r.deleted_at IS NULL
      AND ev.deleted_at IS NULL
      AND (v_is_super OR ev.church_id = v_church_id)
      AND (p_event_id IS NULL OR r.event_id = p_event_id)
  ),
  off AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.financial_entries fe
    WHERE fe.type = 'income'
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = fe.event_id
          AND e.deleted_at IS NULL
          AND (v_is_super OR e.church_id = v_church_id)
      )
      AND (p_event_id IS NULL OR fe.event_id = p_event_id)
  ),
  exp AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.financial_entries fe
    WHERE fe.type = 'expense'
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = fe.event_id
          AND e.deleted_at IS NULL
          AND (v_is_super OR e.church_id = v_church_id)
      )
      AND (p_event_id IS NULL OR fe.event_id = p_event_id)
  )
  SELECT
    paid_reg.total,
    off.total,
    paid_reg.total + off.total,
    exp.total,
    paid_reg.total + off.total - exp.total
  FROM paid_reg, off, exp;
END;
$$;

-- ============================================================
-- 3) GRANTs — ensure authenticated role can call both RPCs
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_financial_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_summary(UUID) TO anon;
