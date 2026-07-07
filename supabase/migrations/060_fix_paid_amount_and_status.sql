-- =============================================
-- 060: Corrige paid_amount e payment_status
-- Recalcula paid_amount a partir da tabela payments
-- e auto-configura payment_status = 'paid' quando
-- totalPago >= preço estipulado
-- =============================================

-- 1. Recalcula paid_amount de todas as inscrições a partir dos payments
UPDATE public.registrations r
SET paid_amount = sub.total
FROM (
  SELECT
    p.registration_id,
    SUM(p.amount) AS total
  FROM public.payments p
  WHERE p.status = 'paid'
  GROUP BY p.registration_id
) sub
WHERE r.id = sub.registration_id;

-- Zera paid_amount para inscrições sem pagamentos
UPDATE public.registrations
SET paid_amount = NULL
WHERE id NOT IN (
  SELECT DISTINCT registration_id FROM public.payments WHERE status = 'paid'
)
AND paid_amount IS NOT NULL;

-- 2. Auto-configura payment_status = 'paid' quando totalPago >= preço estipulado
UPDATE public.registrations r
SET payment_status = 'paid'
WHERE COALESCE(r.paid_amount, 0) >= COALESCE(
  (SELECT el.price FROM public.event_lots el WHERE el.id = r.lot_id),
  (SELECT e.price FROM public.events e WHERE e.id = r.event_id),
  0
)
AND COALESCE(
  (SELECT el.price FROM public.event_lots el WHERE el.id = r.lot_id),
  (SELECT e.price FROM public.events e WHERE e.id = r.event_id),
  0
) > 0
AND r.payment_status != 'paid';
