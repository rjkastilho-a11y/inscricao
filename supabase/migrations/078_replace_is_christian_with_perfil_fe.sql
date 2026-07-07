-- Replace is_christian (checkbox) with perfil_fe (select)
-- Values: "cristao" / "nao_cristao"

-- 1. Add perfil_fe column to registrations
ALTER TABLE public.registrations ADD COLUMN perfil_fe TEXT;

-- 2. Backfill from existing is_christian data
UPDATE public.registrations SET perfil_fe = 'cristao' WHERE is_christian = true;
UPDATE public.registrations SET perfil_fe = 'nao_cristao' WHERE is_christian = false OR is_christian IS NULL;

-- 3. Update the default field: change is_christian to perfil_fe
UPDATE public.event_form_fields
SET
  field_key = 'perfil_fe',
  field_type = 'select',
  label = 'Qual opção melhor descreve você hoje?',
  placeholder = 'Selecione...',
  required = TRUE,
  options = '["Já sou cristão(ã)", "Ainda não sou cristão(ã) / estou conhecendo"]'::jsonb,
  sort_order = 12,
  conditional_logic = NULL,
  db_column = 'perfil_fe'
WHERE field_key = 'is_christian' AND event_id IS NULL;

-- 4. Update per-event copies of this field
UPDATE public.event_form_fields
SET
  field_key = 'perfil_fe',
  field_type = 'select',
  label = 'Qual opção melhor descreve você hoje?',
  options = '["Já sou cristão(ã)", "Ainda não sou cristão(ã) / estou conhecendo"]'::jsonb,
  conditional_logic = NULL,
  db_column = 'perfil_fe'
WHERE field_key = 'is_christian' AND event_id IS NOT NULL;

-- 5. Set conditional_logic on all christian_life default fields (except perfil_fe)
UPDATE public.event_form_fields
SET conditional_logic = 
  '{"enabled":true,"groups":[{"id":"00000000-0000-0000-0000-000000000001","operator":"AND","conditions":[{"field_key":"perfil_fe","comparison":"equals","value":"Já sou cristão(ã)"}],"actions":["show"]}]}'::jsonb
WHERE field_key IN (
  'is_baptized', 'church', 'pastor', 'church_role', 'church_role_other',
  'pastoral_authorization', 'is_pastor', 'godparent', 'godparent_contact'
) AND event_id IS NULL;

-- 6. Propagate conditional_logic to per-event copies
UPDATE public.event_form_fields e
SET conditional_logic = d.conditional_logic
FROM public.event_form_fields d
WHERE d.field_key = e.field_key
  AND d.event_id IS NULL
  AND e.event_id IS NOT NULL;
