-- Migration 072: Adicionar campo payment_link na tabela events
-- Permite ao admin informar uma URL de pagamento externa (MercadoPago, Stripe, etc.)

ALTER TABLE public.events ADD COLUMN payment_link TEXT DEFAULT NULL;
