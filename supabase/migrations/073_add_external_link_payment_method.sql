-- Migration 073: Adicionar 'external_link' ao payment_method_enum
-- Permite ao inscrito selecionar "Pagar online (Link externo)" como forma de pagamento

ALTER TYPE public.payment_method_enum ADD VALUE IF NOT EXISTS 'external_link';
