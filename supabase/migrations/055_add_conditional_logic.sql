-- Adiciona coluna de lógica condicional aos campos do formulário
-- Armazena regras de visibilidade/obrigatoriedade em JSONB
ALTER TABLE public.event_form_fields
  ADD COLUMN conditional_logic JSONB DEFAULT NULL;
