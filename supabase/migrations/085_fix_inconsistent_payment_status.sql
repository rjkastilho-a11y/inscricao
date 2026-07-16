-- ==============================================================
-- MIGRAÇÃO 085: Corrigir payment_status inconsistente
-- Inscrições com payment_status='paid' mas paid_amount inferior
-- ao preço do lote são revertidas para 'pending'.
-- ==============================================================

-- 1. Recalcular paid_amount a partir da tabela payments
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

-- 2. Zerar paid_amount para inscrições sem pagamentos
UPDATE public.registrations
SET paid_amount = NULL
WHERE id NOT IN (
  SELECT DISTINCT registration_id FROM public.payments WHERE status = 'paid'
)
AND paid_amount IS NOT NULL;

-- 3. Reverter payment_status de 'paid' para 'pending' quando
--    o total pago é inferior ao preço do lote/evento
--    APENAS para eventos ainda abertos (is_open = true)
UPDATE public.registrations r
SET payment_status = 'pending'
WHERE r.payment_status = 'paid'
  AND r.event_id IN (SELECT id FROM public.events WHERE is_open = true)
  AND COALESCE(r.paid_amount, 0) < COALESCE(
    (SELECT el.price FROM public.event_lots el WHERE el.id = r.lot_id),
    (SELECT e.price FROM public.events e WHERE e.id = r.event_id),
    0
  )
  AND COALESCE(
    (SELECT el.price FROM public.event_lots el WHERE el.id = r.lot_id),
    (SELECT e.price FROM public.events e WHERE e.id = r.event_id),
    0
  ) > 0;

-- 4. Log das correções
DO $$
DECLARE
  v_corrigidas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_corrigidas FROM public.registrations r
  WHERE r.payment_status = 'paid'
    AND r.event_id IN (SELECT id FROM public.events WHERE is_open = true)
    AND COALESCE(r.paid_amount, 0) < COALESCE(
      (SELECT el.price FROM public.event_lots el WHERE el.id = r.lot_id),
      (SELECT e.price FROM public.events e WHERE e.id = r.event_id),
      0
    )
    AND COALESCE(
      (SELECT el.price FROM public.event_lots el WHERE el.id = r.lot_id),
      (SELECT e.price FROM public.events e WHERE e.id = r.event_id),
      0
    ) > 0;

  RAISE NOTICE 'Inscrições corrigidas (paid → pending): %', v_corrigidas;
END $$;
