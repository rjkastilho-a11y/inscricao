-- ==============================================================
-- MIGRAÇÃO 022: Adiciona registration_id na tabela financial_entries
--
-- 1. Adiciona coluna registration_id (FK opcional para registrations)
-- 2. Unique constraint (registration_id, type) para evitar duplicação
--    de lançamentos financeiros para a mesma inscrição
-- ==============================================================

ALTER TABLE public.financial_entries
  ADD COLUMN registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL;

-- Unique constraint: permite múltiplos NULLs, mas cada par (registration_id, type)
-- só pode aparecer uma vez. Assim cada inscrição tem no máximo 1 entrada (income)
-- e 1 saída (reembolso).
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_registration_type_key UNIQUE (registration_id, type);
