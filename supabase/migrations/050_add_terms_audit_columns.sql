-- ==============================================================
-- MIGRAÇÃO 050: Colunas de auditoria de aceite de termos
--
-- Adiciona terms_accepted_at e terms_version na tabela
-- registrations para registro legal do aceite do usuário.
-- ==============================================================

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

-- ==============================================================
-- FIM DA MIGRAÇÃO 050
-- ==============================================================
