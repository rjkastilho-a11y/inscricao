-- Migration 070: Condicionalidade - spouse_name e wedding_date aparecem apenas quando Casado(a)
-- spouse_name (Nome do Cônjuge) e wedding_date (Data de Casamento) ficam ocultos por padrão
-- Só aparecem quando marital_status = "Casado(a)"

-- 1. Atualizar defaults (event_id IS NULL)
UPDATE public.event_form_fields
SET conditional_logic = jsonb_build_object(
  'enabled', true,
  'groups', jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'operator', 'AND',
    'conditions', jsonb_build_array(jsonb_build_object(
      'field_key', 'marital_status',
      'comparison', 'equals',
      'value', 'Casado(a)'
    )),
    'actions', jsonb_build_array('show')
  ))
)
WHERE field_key IN ('spouse_name', 'wedding_date')
  AND event_id IS NULL
  AND is_default = true;

-- 2. Propagar para eventos existentes que já tenham override
UPDATE public.event_form_fields eef
SET conditional_logic = (
  SELECT def.conditional_logic FROM public.event_form_fields def
  WHERE def.field_key = eef.field_key
    AND def.event_id IS NULL
    AND def.is_default = true
)
WHERE eef.field_key IN ('spouse_name', 'wedding_date')
  AND eef.event_id IS NOT NULL;
