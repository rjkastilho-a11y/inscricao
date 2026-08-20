-- 116_add_dashboard_performance_indexes.sql
-- Performance: composite indexes for RPC CTEs

-- financial_entries: covers the "off"/"exp" CTEs pattern
-- SELECT SUM(amount) FROM financial_entries WHERE event_id = X AND type = 'income'
CREATE INDEX IF NOT EXISTS idx_financial_entries_event_type
  ON public.financial_entries(event_id, type);

-- registrations: covers the "reg" CTE pattern
-- JOIN on event_id + FILTER on payment_status, skip soft-deleted
CREATE INDEX IF NOT EXISTS idx_registrations_event_payment
  ON public.registrations(event_id, payment_status)
  WHERE deleted_at IS NULL;
