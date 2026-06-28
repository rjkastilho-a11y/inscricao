-- ==============================================================
-- MIGRATION 006: Check-in — coluna checked_in
-- Idempotente: pode rodar múltiplas vezes com IF NOT EXISTS
-- ==============================================================

-- ==============================================================
-- (1) ADICIONAR COLUNA
-- ==============================================================
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS checked_in BOOLEAN NOT NULL DEFAULT false;

-- ==============================================================
-- (2) GRANTS (reforço — já existente, mas idempotente)
-- ==============================================================
GRANT ALL ON public.registrations TO anon, authenticated;

-- ==============================================================
-- FIM
-- ==============================================================
