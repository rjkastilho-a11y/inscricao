-- ==============================================================
-- MIGRAÇÃO 063: Adicionar colunas faltantes em registrations
-- e definir db_column para todos os campos padrão
-- ==============================================================

-- 1. Adicionar colunas físicas na tabela registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS has_allergies BOOLEAN,
  ADD COLUMN IF NOT EXISTS allergy_description TEXT,
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT,
  ADD COLUMN IF NOT EXISTS accept_terms BOOLEAN NOT NULL DEFAULT false;

-- 2. Atualizar db_column nos campos padrão (template global - event_id IS NULL)
UPDATE public.event_form_fields SET db_column = 'cpf' WHERE field_key = 'cpf' AND event_id IS NULL AND db_column IS NULL;
UPDATE public.event_form_fields SET db_column = 'rg' WHERE field_key = 'rg' AND event_id IS NULL AND db_column IS NULL;
UPDATE public.event_form_fields SET db_column = 'cep' WHERE field_key = 'cep' AND event_id IS NULL AND db_column IS NULL;
UPDATE public.event_form_fields SET db_column = 'address' WHERE field_key = 'address' AND event_id IS NULL AND db_column IS NULL;
UPDATE public.event_form_fields SET db_column = 'city' WHERE field_key = 'city' AND event_id IS NULL AND db_column IS NULL;
UPDATE public.event_form_fields SET db_column = 'state' WHERE field_key = 'state' AND event_id IS NULL AND db_column IS NULL;
UPDATE public.event_form_fields SET db_column = 'has_allergies' WHERE field_key = 'has_allergies' AND event_id IS NULL AND db_column IS NULL;
UPDATE public.event_form_fields SET db_column = 'allergy_description' WHERE field_key = 'allergy_description' AND event_id IS NULL AND db_column IS NULL;
UPDATE public.event_form_fields SET db_column = 'dietary_restrictions' WHERE field_key = 'dietary_restrictions' AND event_id IS NULL AND db_column IS NULL;
UPDATE public.event_form_fields SET db_column = 'accept_terms' WHERE field_key = 'accept_terms' AND event_id IS NULL AND db_column IS NULL;

-- 3. Para eventos que já copiaram os campos padrão (is_custom = true), propagar db_column
UPDATE public.event_form_fields ef
SET db_column = def.db_column
FROM public.event_form_fields def
WHERE ef.event_id IS NOT NULL
  AND ef.field_key = def.field_key
  AND def.event_id IS NULL
  AND ef.db_column IS NULL
  AND def.db_column IS NOT NULL;

-- 4. Índices para performance nas novas colunas
CREATE INDEX IF NOT EXISTS idx_registrations_cpf ON public.registrations(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_rg ON public.registrations(rg) WHERE rg IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_cep ON public.registrations(cep) WHERE cep IS NOT NULL;