-- =============================================================
-- Kairós Events — Add invite_id to registrations
-- Migration: 016_add_registrations_invite_id
-- Descrição: Adiciona coluna invite_id na tabela registrations
--            para auditoria de convites de uso único
-- =============================================================

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES public.event_invites(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.registrations.invite_id IS 'Referência ao convite de uso único utilizado na inscrição (auditoria).';
