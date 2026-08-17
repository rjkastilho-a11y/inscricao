-- ==============================================================
-- Kairós Events — Add neighborhood column + default form field
-- Migration: 101_add_neighborhood_to_registrations
-- Descrição: Adiciona coluna neighborhood na tabela registrations,
--            reordena os campos de endereço do template padrão
--            (CEP, Endereço, Bairro, Cidade, Estado), insere o
--            campo padrão "Bairro" e atualiza o placeholder do
--            endereço para refletir que agora é só logradouro.
-- ==============================================================

-- 1. Adicionar coluna física na tabela registrations
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS neighborhood TEXT;

COMMENT ON COLUMN public.registrations.neighborhood IS 'Bairro do inscrito preenchido via formulário ou ViaCEP';

-- 2. Renumerar os campos de endereço do template padrão (event_id IS NULL)
--    para a ordem: CEP(8), Endereço(9), Bairro(10), Cidade(11), Estado(12)
UPDATE public.event_form_fields SET sort_order = 8  WHERE field_key = 'cep'     AND event_id IS NULL;
UPDATE public.event_form_fields SET sort_order = 9  WHERE field_key = 'address' AND event_id IS NULL;
UPDATE public.event_form_fields SET sort_order = 11 WHERE field_key = 'city'    AND event_id IS NULL;
UPDATE public.event_form_fields SET sort_order = 12 WHERE field_key = 'state'   AND event_id IS NULL;

-- 3. Inserir o campo padrão "Bairro" no template (disponível via fetchDefaultFieldsByStep)
INSERT INTO public.event_form_fields
  (event_id, field_key, field_type, label, placeholder, required, sort_order, step, is_default, is_active, db_column)
VALUES
  (NULL, 'neighborhood', 'text', 'Bairro', '', FALSE, 10, 'personal', TRUE, TRUE, 'neighborhood')
ON CONFLICT (event_id, field_key, step) DO NOTHING;

-- 4. Atualizar placeholder do endereço (logradouro; usuário digita número/complemento)
UPDATE public.event_form_fields SET placeholder = 'Rua e número' WHERE field_key = 'address' AND event_id IS NULL;
