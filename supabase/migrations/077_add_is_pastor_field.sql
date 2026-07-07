-- Add default field 'is_pastor' to christian_life step
INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, options, sort_order, step, is_default, is_active, conditional_logic, db_column)
VALUES (
  NULL,
  'is_pastor',
  'select',
  'É pastor(a)?',
  '',
  FALSE,
  '["Sim", "Não"]'::jsonb,
  14.5,
  'christian_life',
  TRUE,
  TRUE,
  '{"enabled":true,"groups":[{"id":"00000000-0000-0000-0000-000000000001","operator":"AND","conditions":[{"field_key":"is_christian","comparison":"equals","value":"true"}],"actions":["show"]}]}'::jsonb,
  'is_pastor'
);

-- Propagate conditional_logic to existing event copies
UPDATE public.event_form_fields
SET conditional_logic = (
  SELECT conditional_logic FROM public.event_form_fields
  WHERE field_key = 'is_pastor' AND event_id IS NULL
)
WHERE field_key = 'is_pastor' AND event_id IS NOT NULL;
