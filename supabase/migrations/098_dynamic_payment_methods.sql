-- Migration 098: Métodos de pagamento dinâmicos por evento
-- O organizador escolhe quais métodos aceitar e fornece instruções de pagamento

-- 1) events: quais métodos o evento aceita (text[]; padrão = todos exceto link externo)
ALTER TABLE public.events
  ADD COLUMN allowed_payment_methods TEXT[] NOT NULL
  DEFAULT '{pix,credit_card,cash,bank_transfer,other}';

-- 2) events: chave PIX exibida na tela de sucesso
ALTER TABLE public.events
  ADD COLUMN pix_key TEXT DEFAULT NULL;

-- 3) events: dados bancários para transferência
ALTER TABLE public.events
  ADD COLUMN bank_details TEXT DEFAULT NULL;

-- 4) registrations: detalhe extra do método (ex.: texto informado quando "Outro")
ALTER TABLE public.registrations
  ADD COLUMN payment_method_details TEXT DEFAULT NULL;
