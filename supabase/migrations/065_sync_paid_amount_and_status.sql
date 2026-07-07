-- ==============================================================
-- MIGRAÇÃO 065: Sincronizar paid_amount e payment_status
-- com a tabela payments
-- ==============================================================

-- 1. Para inscrições com payment_status='paid' mas paid_amount NULL,
--    recalcular a partir da tabela payments
UPDATE public.registrations r
SET paid_amount = COALESCE(
  (SELECT SUM(amount) FROM public.payments WHERE registration_id = r.id AND status = 'paid'),
  0
)
WHERE r.payment_status = 'paid'
  AND r.paid_amount IS NULL;

-- 2. Para inscrições com payment_status='paid' mas paid_amount=0,
--    verificar se há pagamentos na tabela payments
UPDATE public.registrations r
SET paid_amount = COALESCE(
  (SELECT SUM(amount) FROM public.payments WHERE registration_id = r.id AND status = 'paid'),
  0
)
WHERE r.payment_status = 'paid'
  AND (r.paid_amount IS NULL OR r.paid_amount = 0);

-- 3. Se não há pagamentos na tabela payments, resetar payment_status para 'pending'
UPDATE public.registrations r
SET payment_status = 'pending'
WHERE r.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.payments WHERE registration_id = r.id AND status = 'paid'
  );

-- 4. Se há pagamentos mas payment_status não é 'paid', atualizar para 'paid'
UPDATE public.registrations r
SET payment_status = 'paid',
    paid_amount = COALESCE(
      (SELECT SUM(amount) FROM public.payments WHERE registration_id = r.id AND status = 'paid'),
      0
    )
WHERE r.payment_status != 'paid'
  AND EXISTS (
    SELECT 1 FROM public.payments WHERE registration_id = r.id AND status = 'paid'
  );

-- 5. Log das correções
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.registrations
  WHERE payment_status = 'paid' AND paid_amount IS NOT NULL AND paid_amount > 0;
  RAISE NOTICE 'Inscrições com payment_status=paid e paid_amount>0: %', v_count;
END $$;
