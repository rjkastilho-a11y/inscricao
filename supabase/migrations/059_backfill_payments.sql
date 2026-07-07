-- =============================================
-- 059: Backfill de pagamentos legados
-- Insere registros na tabela payments para inscrições
-- que têm paid_amount > 0 mas nenhum registro em payments
-- =============================================

INSERT INTO public.payments (registration_id, amount, method, status, notes)
SELECT
  r.id,
  r.paid_amount,
  COALESCE(r.payment_method, 'pix'),
  'paid',
  'Registro legado (backfill)'
FROM public.registrations r
WHERE r.paid_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p WHERE p.registration_id = r.id
  );
