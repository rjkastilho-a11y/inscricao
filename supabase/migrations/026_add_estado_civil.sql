-- ==============================================================
-- MIGRAÇÃO 026: Adiciona Estado Civil ao template padrão
-- ==============================================================

INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, sort_order, step, is_default, is_active)
VALUES (NULL, 'estado_civil', 'select', 'Estado civil', 'Selecione...', FALSE, 11.5, 'personal', TRUE, TRUE);

UPDATE public.event_form_fields
SET options = '["Solteiro(a)","Casado(a)","Divorciado(a)","Viúvo(a)","União Estável"]'::jsonb
WHERE field_key = 'estado_civil' AND event_id IS NULL;
