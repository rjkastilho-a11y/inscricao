-- ==============================================================
-- MIGRAÇÃO 020: Corrige RPCs e View para usar preço do lote
-- quando o inscrito selecionou um lote específico.
--
-- O cálculo correto é: COALESCE(event_lots.price, events.price)
-- ==============================================================

-- ==============================================================
-- (1) get_dashboard_kpis — usar COALESCE(lot_price, event_price)
-- ==============================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_events        BIGINT,
  open_events         BIGINT,
  total_registrations BIGINT,
  paid_registrations  BIGINT,
  pending_registrations BIGINT,
  total_revenue       DECIMAL,
  total_offerings     DECIMAL,
  total_expenses      DECIMAL,
  total_income        DECIMAL,
  balance             DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_super BOOLEAN;
BEGIN
  v_is_super := public.is_super_admin();

  RETURN QUERY
  WITH
  user_church AS (
    SELECT church_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
  ),
  ev AS (
    SELECT e.id, e.price, e.is_open
    FROM public.events e
    WHERE (v_is_super OR e.church_id = (SELECT church_id FROM user_church))
      AND (p_event_id IS NULL OR e.id = p_event_id)
  ),
  reg AS (
    SELECT r.event_id, r.payment_status, COALESCE(el.price, e.price) AS price
    FROM public.registrations r
    JOIN ev e ON e.id = r.event_id
    LEFT JOIN public.event_lots el ON el.id = r.lot_id
    WHERE (v_is_super OR r.church_id = (SELECT church_id FROM user_church))
  ),
  off AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.offerings o
    WHERE EXISTS (SELECT 1 FROM ev e WHERE e.id = o.event_id)
      AND (p_event_id IS NULL OR o.event_id = p_event_id)
  ),
  exp AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.expenses ex
    WHERE EXISTS (SELECT 1 FROM ev e WHERE e.id = ex.event_id)
      AND (p_event_id IS NULL OR ex.event_id = p_event_id)
  )
  SELECT
    (SELECT COUNT(*) FROM ev),
    (SELECT COUNT(*) FROM public.events
     WHERE is_open = true
       AND (v_is_super OR church_id = (SELECT church_id FROM user_church))
       AND (p_event_id IS NULL OR id = p_event_id)),
    COUNT(*),
    COUNT(*) FILTER (WHERE payment_status = 'paid'),
    COUNT(*) FILTER (WHERE payment_status = 'pending'),
    COALESCE(SUM(price) FILTER (WHERE payment_status = 'paid'), 0),
    off.total,
    exp.total,
    COALESCE(SUM(price) FILTER (WHERE payment_status = 'paid'), 0) + off.total,
    COALESCE(SUM(price) FILTER (WHERE payment_status = 'paid'), 0) + off.total - exp.total
  FROM reg, off, exp;
END;
$$;

-- ==============================================================
-- (2) get_financial_summary — usar COALESCE(lot_price, event_price)
-- ==============================================================
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
  v_is_super BOOLEAN;
BEGIN
  v_is_super := public.is_super_admin();

  RETURN QUERY
  WITH
  user_church AS (
    SELECT church_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
  ),
  paid_reg AS (
    SELECT COALESCE(SUM(COALESCE(el.price, ev.price)), 0) AS total
    FROM public.registrations r
    JOIN public.events ev ON ev.id = r.event_id
    LEFT JOIN public.event_lots el ON el.id = r.lot_id
    WHERE r.payment_status = 'paid'
      AND (v_is_super OR ev.church_id = (SELECT church_id FROM user_church))
      AND (p_event_id IS NULL OR r.event_id = p_event_id)
  ),
  off AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.offerings o
    WHERE EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = o.event_id
        AND (v_is_super OR e.church_id = (SELECT church_id FROM user_church))
    )
      AND (p_event_id IS NULL OR o.event_id = p_event_id)
  ),
  exp AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM public.expenses ex
    WHERE EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ex.event_id
        AND (v_is_super OR e.church_id = (SELECT church_id FROM user_church))
    )
      AND (p_event_id IS NULL OR ex.event_id = p_event_id)
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

-- ==============================================================
-- (3) v_dashboard_per_event — usar COALESCE(lot_price, event_price)
-- ==============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'v_dashboard_per_event'
  ) THEN
    DROP VIEW IF EXISTS public.v_dashboard_per_event;
  END IF;
END;
$$;

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

-- ==============================================================
-- FIM DA MIGRAÇÃO 020
-- ==============================================================
