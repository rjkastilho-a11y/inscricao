-- Kairós Events — Add origin to registrations

-- Migration: 100_add_registrations_origin
-- Descrição: Adiciona coluna origin na tabela registrations para distinguir
--            a origem da inscrição: public (link público), admin (painel ADM)
--            ou invite (link de convite de uso único).

ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'public'
CHECK (origin IN ('public','admin','invite'));

COMMENT ON COLUMN public.registrations.origin IS 'Origem da inscrição: public, admin ou invite';
