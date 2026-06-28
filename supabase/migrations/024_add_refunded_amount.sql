-- ==============================================================
-- MIGRAÇÃO 024: Adiciona refunded_amount em registrations
--
-- Armazena o valor reembolsado para exibição na ficha do inscrito.
-- O paid_amount permanece preservado mesmo após reembolso.
-- ==============================================================

ALTER TABLE public.registrations
  ADD COLUMN refunded_amount DECIMAL(10,2) DEFAULT NULL;
