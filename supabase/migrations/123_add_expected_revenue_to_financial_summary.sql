-- 123_add_expected_revenue_to_financial_summary.sql
-- Add expected_revenue column to get_financial_summary RPC
-- This is needed for the FinancialPage "Previsto" KPI card
--
-- Logic (from FinancialPage.tsx lines 141-143):
--   totalExpected = sum of effective_price for ALL registrations
--                   where status != 'canceled' AND status != 'cortesia'
--
-- Changes from migration 119:
--   1) Added CTE exp_rev for expected_revenue
--   2) Added expected_revenue as first column in RETURNS TABLE
--   3) Added exp_rev.total as first value in SELECT

DROP FUNCTION IF EXISTS public.get_financial_summary(UUID);

CREATE OR REPLACE FUNCTION public.get_financial_summary(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  expected_revenue     DECIMAL,
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
  exp_rev AS (
    -- expected_revenue: all registrations except canceled and cortesia
    SELECT COALESCE(SUM(COALESCE(el.price, ev.price)), 0) AS total
    FROM public.registrations r
    JOIN public.events ev ON ev.id = r.event_id
    LEFT JOIN public.event_lots el ON el.id = r.lot_id
    WHERE r.deleted_at IS NULL
      AND ev.deleted_at IS NULL
      AND r.payment_status != 'canceled'
      AND r.payment_status != 'cortesia'
      AND (v_is_super OR ev.church_id = v_church_id)
      AND (p_event_id IS NULL OR r.event_id = p_event_id)
  ),
  paid_reg AS (
    -- income_registrations: only paid registrations
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
    -- income_offerings: financial_entries income excluding registration payments
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.financial_entries fe
    WHERE fe.type = 'income'
      AND fe.category != 'registration'
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = fe.event_id
          AND e.deleted_at IS NULL
          AND (v_is_super OR e.church_id = v_church_id)
      )
      AND (p_event_id IS NULL OR fe.event_id = p_event_id)
  ),
  exp AS (
    -- total_expenses: all financial_entries expenses
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
    (SELECT total FROM exp_rev),
    (SELECT total FROM paid_reg),
    (SELECT total FROM off),
    (SELECT total FROM paid_reg) + (SELECT total FROM off),
    (SELECT total FROM exp),
    (SELECT total FROM paid_reg) + (SELECT total FROM off) - (SELECT total FROM exp);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_summary(UUID) TO anon;
