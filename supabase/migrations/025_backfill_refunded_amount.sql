-- ==============================================================
-- MIGRAÇÃO 025: Backfill do refunded_amount para reembolsos antigos
--
-- 1. Remove duplicatas de reembolso (mantém a mais antiga)
-- 2. Match direto via registration_id
-- 3. Match por event_id + amount (apenas 1 por inscrição via ROW_NUMBER)
-- 4. Fallback: preço do lote / evento como estimativa
-- ==============================================================

-- (1) Remove duplicatas de reembolso: para cada par (registration_id, type),
--     mantém a entry mais antiga e deleta as demais.
--     Isso previne violação do unique constraint no backfill.
DELETE FROM public.financial_entries fe
USING public.financial_entries fe2
WHERE fe.registration_id IS NOT NULL
  AND fe.registration_id = fe2.registration_id
  AND fe.type = fe2.type
  AND fe.type = 'expense'
  AND fe.created_at > fe2.created_at;

-- (1b) Remove duplicatas de reembolso sem registration_id
--      (mesmo evento + amount, mantém a mais antiga via DISTINCT ON)
DELETE FROM public.financial_entries fe
WHERE fe.registration_id IS NULL
  AND fe.type = 'expense'
  AND fe.category = 'reembolso'
  AND fe.id NOT IN (
    SELECT DISTINCT ON (event_id, amount) id
    FROM public.financial_entries
    WHERE registration_id IS NULL
      AND type = 'expense'
      AND category = 'reembolso'
    ORDER BY event_id, amount, created_at ASC
  );

-- (2) Match direto: reembolsos que já têm registration_id
UPDATE public.registrations r
SET refunded_amount = fe.amount
FROM public.financial_entries fe
WHERE r.id = fe.registration_id
  AND fe.type = 'expense'
  AND fe.category = 'reembolso'
  AND r.refunded_amount IS NULL;

-- (3) Match por event_id + amount: reembolsos antigos sem registration_id.
--     Usa ROW_NUMBER para pegar apenas 1 entry por inscrição.
UPDATE public.financial_entries fe
SET registration_id = matched.id
FROM (
  SELECT DISTINCT ON (fe_inner.id) fe_inner.id AS fe_id, r.id
  FROM public.financial_entries fe_inner
  JOIN public.registrations r
    ON r.event_id = fe_inner.event_id
   AND COALESCE(r.paid_amount, 0) = fe_inner.amount
  WHERE fe_inner.registration_id IS NULL
    AND fe_inner.type = 'expense'
    AND fe_inner.category = 'reembolso'
    AND r.payment_status IN ('refunded', 'canceled')
    AND r.refunded_amount IS NULL
  ORDER BY fe_inner.id, r.id
) matched
WHERE fe.id = matched.fe_id;

-- (3b) Aplica refunded_amount para os novos matches
UPDATE public.registrations r
SET refunded_amount = fe.amount
FROM public.financial_entries fe
WHERE r.id = fe.registration_id
  AND fe.type = 'expense'
  AND fe.category = 'reembolso'
  AND r.refunded_amount IS NULL;

-- (4) Fallback: preço do lote/evento para o que ainda ficou sem match
UPDATE public.registrations r
SET refunded_amount = COALESCE(
  (SELECT el.price FROM public.event_lots el WHERE el.id = r.lot_id),
  (SELECT ev.price FROM public.events ev WHERE ev.id = r.event_id),
  0
)
WHERE r.payment_status IN ('refunded', 'canceled')
  AND r.refunded_amount IS NULL;
