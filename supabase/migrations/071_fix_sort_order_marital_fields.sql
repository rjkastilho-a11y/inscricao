-- Migration 071: Corrigir sort_order de marital_status, spouse_name e wedding_date
-- Ordem correta: Estado Civil → Nome do Cônjuge → Data de Casamento

-- Defaults (event_id IS NULL)
UPDATE public.event_form_fields SET sort_order = 12 WHERE field_key = 'marital_status' AND event_id IS NULL AND is_default = true;
UPDATE public.event_form_fields SET sort_order = 13 WHERE field_key = 'spouse_name' AND event_id IS NULL AND is_default = true;
UPDATE public.event_form_fields SET sort_order = 14 WHERE field_key = 'wedding_date' AND event_id IS NULL AND is_default = true;

-- Overrides existentes (event_id IS NOT NULL)
UPDATE public.event_form_fields SET sort_order = 12 WHERE field_key = 'marital_status' AND event_id IS NOT NULL;
UPDATE public.event_form_fields SET sort_order = 13 WHERE field_key = 'spouse_name' AND event_id IS NOT NULL;
UPDATE public.event_form_fields SET sort_order = 14 WHERE field_key = 'wedding_date' AND event_id IS NOT NULL;
