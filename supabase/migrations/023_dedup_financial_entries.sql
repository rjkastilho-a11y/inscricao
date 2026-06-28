-- ==============================================================
-- MIGRAÇÃO 023: Limpeza de duplicatas em financial_entries
--
-- 1. Backfill do registration_id para entries existentes
-- 2. Remove duplicatas (mantém a mais antiga)
-- 3. Remove órfãos sem registration_id
-- ==============================================================

-- (1) Backfill: vincula financial_entries às registrations correspondentes
--     Match por event_id + amount = paid_amount
UPDATE public.financial_entries fe
SET registration_id = r.id
FROM public.registrations r
WHERE fe.registration_id IS NULL
  AND fe.type = 'income'
  AND fe.category = 'registration'
  AND fe.event_id = r.event_id
  AND fe.amount = r.paid_amount;

-- (2) Remove duplicatas: para cada par (registration_id, type),
--     mantém a entry mais antiga e deleta as demais
DELETE FROM public.financial_entries fe
USING public.financial_entries fe2
WHERE fe.registration_id IS NOT NULL
  AND fe.registration_id = fe2.registration_id
  AND fe.type = fe2.type
  AND fe.created_at > fe2.created_at;

-- (3) Remove órfãos: entries do tipo 'registration' que não puderam
--     ser vinculadas a nenhuma inscrição. Foram criadas automaticamente
--     pelo bug anterior e não têm contraparte válida.
DELETE FROM public.financial_entries
WHERE registration_id IS NULL
  AND type = 'income'
  AND category = 'registration';
