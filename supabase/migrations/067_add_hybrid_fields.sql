-- ==============================================================
-- MIGRAÇÃO 067: Adicionar campos híbridos (pré-definidos + extra_fields)
-- ================================================= ==============================================================

-- 1. Colunas físicas em registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS spouse_name TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS wedding_date DATE,
  ADD COLUMN IF NOT EXISTS has_special_needs BOOLEAN,
  ADD COLUMN IF NOT EXISTS special_needs_description TEXT;

-- 2. Campos pré-definidos no template global (event_id IS NULL)

-- Remove estado_civil antigo (será substituído por marital_status)
DELETE FROM public.event_form_fields WHERE field_key = 'estado_civil' AND event_id IS NULL;

-- DADOS PESSOAIS
INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, options, sort_order, step, is_default, is_active, db_column)
VALUES
  (NULL, 'spouse_name', 'text', 'Nome do Cônjuge', '', FALSE, NULL, 12, 'personal', TRUE, TRUE, 'spouse_name'),
  (NULL, 'marital_status', 'select', 'Estado Civil', 'Selecione...', FALSE, '["Solteiro(a)","Casado(a)","Divorciado(a)","Viúvo(a)","União Estável"]'::jsonb, 13, 'personal', TRUE, TRUE, 'marital_status'),
  (NULL, 'wedding_date', 'date', 'Data de Casamento', '', FALSE, NULL, 14, 'personal', TRUE, TRUE, 'wedding_date')
ON CONFLICT (event_id, field_key) DO UPDATE SET
  db_column = EXCLUDED.db_column,
  field_type = EXCLUDED.field_type,
  options = EXCLUDED.options,
  is_default = TRUE;

-- SAÚDE
INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, options, sort_order, step, is_default, is_active, db_column)
VALUES
  (NULL, 'has_special_needs', 'checkbox', 'Possui Necessidades Especiais?', '', FALSE, NULL, 25, 'health', TRUE, TRUE, 'has_special_needs'),
  (NULL, 'special_needs_description', 'text', 'Qual?', '', FALSE, NULL, 26, 'health', TRUE, TRUE, 'special_needs_description')
ON CONFLICT (event_id, field_key) DO UPDATE SET
  db_column = EXCLUDED.db_column,
  field_type = EXCLUDED.field_type,
  is_default = TRUE;

-- 3. Propagar para eventos existentes (is_custom = true)
-- Dados Pessoais
INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, options, sort_order, step, is_default, is_active, db_column)
SELECT e.id, 'spouse_name', 'text', 'Nome do Cônjuge', '', FALSE, NULL, 12, 'personal', TRUE, TRUE, 'spouse_name'
FROM public.events e WHERE e.is_custom = true
  AND NOT EXISTS (SELECT 1 FROM public.event_form_fields f WHERE f.event_id = e.id AND f.field_key = 'spouse_name');

INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, options, sort_order, step, is_default, is_active, db_column)
SELECT e.id, 'marital_status', 'select', 'Estado Civil', 'Selecione...', FALSE, '["Solteiro(a)","Casado(a)","Divorciado(a)","Viúvo(a)","União Estável"]'::jsonb, 13, 'personal', TRUE, TRUE, 'marital_status'
FROM public.events e WHERE e.is_custom = true
  AND NOT EXISTS (SELECT 1 FROM public.event_form_fields f WHERE f.event_id = e.id AND f.field_key = 'marital_status');

INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, options, sort_order, step, is_default, is_active, db_column)
SELECT e.id, 'wedding_date', 'date', 'Data de Casamento', '', FALSE, NULL, 14, 'personal', TRUE, TRUE, 'wedding_date'
FROM public.events e WHERE e.is_custom = true
  AND NOT EXISTS (SELECT 1 FROM public.event_form_fields f WHERE f.event_id = e.id AND f.field_key = 'wedding_date');

-- Saúde
INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, options, sort_order, step, is_default, is_active, db_column)
SELECT e.id, 'has_special_needs', 'checkbox', 'Possui Necessidades Especiais?', '', FALSE, NULL, 25, 'health', TRUE, TRUE, 'has_special_needs'
FROM public.events e WHERE e.is_custom = true
  AND NOT EXISTS (SELECT 1 FROM public.event_form_fields f WHERE f.event_id = e.id AND f.field_key = 'has_special_needs');

INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, options, sort_order, step, is_default, is_active, db_column)
SELECT e.id, 'special_needs_description', 'text', 'Qual?', '', FALSE, NULL, 26, 'health', TRUE, TRUE, 'special_needs_description'
FROM public.events e WHERE e.is_custom = true
  AND NOT EXISTS (SELECT 1 FROM public.event_form_fields f WHERE f.event_id = e.id AND f.field_key = 'special_needs_description');

-- Remove estado_civil de eventos existentes (substituído por marital_status)
DELETE FROM public.event_form_fields WHERE field_key = 'estado_civil' AND event_id IS NOT NULL;

-- 4. Migrar dados existentes de extra_fields para colunas físicas
UPDATE public.registrations
SET marital_status = extra_fields->>'estado_civil'
WHERE extra_fields ? 'estado_civil' AND (extra_fields->>'estado_civil') IS NOT NULL;

-- Limpar dados migrados do extra_fields
UPDATE public.registrations
SET extra_fields = extra_fields - 'estado_civil'
WHERE extra_fields ? 'estado_civil';

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_registrations_marital_status ON public.registrations(marital_status) WHERE marital_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_spouse_name ON public.registrations(spouse_name) WHERE spouse_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_wedding_date ON public.registrations(wedding_date) WHERE wedding_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_has_special_needs ON public.registrations(has_special_needs) WHERE has_special_needs IS NOT NULL;
