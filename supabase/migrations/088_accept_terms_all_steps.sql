-- ==============================================================
-- MIGRAÇÃO 088: accept_terms como campo padrão em todas as etapas
-- Permite que o admin ative/desative o checkbox de termos
-- em qualquer etapa do formulário.
-- ==============================================================

-- 1. Remover constraint UNIQUE antiga (event_id, field_key)
ALTER TABLE public.event_form_fields
  DROP CONSTRAINT IF EXISTS event_form_fields_event_id_field_key_key;

-- 2. Criar constraint nova que inclui step (permite mesmo field_key em steps diferentes)
ALTER TABLE public.event_form_fields
  ADD CONSTRAINT event_form_fields_event_id_field_key_step_key
  UNIQUE (event_id, field_key, step);

-- 3. Inserir accept_terms como campo padrão nas etapas que ainda não têm
INSERT INTO public.event_form_fields
  (event_id, field_key, field_type, label, placeholder, required, sort_order, step, is_default, is_active)
VALUES
  (NULL, 'accept_terms', 'checkbox', 'Aceito os termos e condições do evento', '', true, 99, 'christian_life', true, true),
  (NULL, 'accept_terms', 'checkbox', 'Aceito os termos e condições do evento', '', true, 99, 'health', true, true),
  (NULL, 'accept_terms', 'checkbox', 'Aceito os termos e condições do evento', '', true, 99, 'emergency', true, true),
  (NULL, 'accept_terms', 'checkbox', 'Aceito os termos e condições do evento', '', true, 99, 'other', true, true)
ON CONFLICT (event_id, field_key, step) DO NOTHING;
