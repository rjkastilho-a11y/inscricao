-- ==============================================================
-- MIGRATION 008: is_active — bloqueio/suspensão de igrejas
-- Idempotente: pode rodar múltiplas vezes sem efeito colateral
-- ==============================================================

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ==============================================================
-- FIM DA MIGRAÇÃO 008
-- ==============================================================
