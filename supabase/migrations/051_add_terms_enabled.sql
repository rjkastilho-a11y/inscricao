-- ==============================================================
-- MIGRAÇÃO 051: Adicionar terms_enabled na tabela events
--
-- Permite ao organizador habilitar/desabilitar o campo de
-- termos e condições no formulário de inscrição.
-- ==============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS terms_enabled BOOLEAN NOT NULL DEFAULT true;

-- ==============================================================
-- FIM DA MIGRAÇÃO 051
-- ==============================================================
