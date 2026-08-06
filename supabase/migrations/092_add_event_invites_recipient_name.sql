-- =============================================================
-- Kairós Events — Coluna recipient_name em event_invites
-- Migration: 092_add_event_invites_recipient_name
-- Descrição: Permite registrar o nome da pessoa para quem o
--            convite foi enviado (editável pelo admin).
-- =============================================================

ALTER TABLE public.event_invites
  ADD COLUMN IF NOT EXISTS recipient_name TEXT;

COMMENT ON COLUMN public.event_invites.recipient_name IS 'Nome da pessoa para quem o convite foi enviado (preenchido/editável pelo admin).';

-- =============================================================
-- FIM DA MIGRAÇÃO 092
-- =============================================================
