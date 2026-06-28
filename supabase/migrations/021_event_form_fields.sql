-- ==============================================================
-- MIGRAÇÃO 021: Formulário Híbrido — campos dinâmicos por evento
--
-- 1. Adiciona flag is_custom em events
-- 2. Cria tabela event_form_fields (template global + por evento)
-- 3. Popula template com campos padrão (is_default = true)
-- 4. Adiciona coluna extra_fields em registrations
-- ==============================================================

-- ==============================================================
-- (1) Flag de formulário personalizado na tabela events
-- ==============================================================
ALTER TABLE public.events
  ADD COLUMN is_custom BOOLEAN NOT NULL DEFAULT false;

-- ==============================================================
-- (2) Tabela de configuração de campos do formulário
-- ==============================================================
CREATE TABLE public.event_form_fields (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES public.events(id) ON DELETE CASCADE,
  field_key   TEXT NOT NULL,
  field_type  TEXT NOT NULL CHECK (field_type IN (
    'text', 'email', 'phone', 'cpf', 'cnpj', 'cep', 'date', 'select',
    'checkbox', 'textarea', 'number'
  )),
  label       TEXT NOT NULL,
  placeholder TEXT DEFAULT '',
  required    BOOLEAN NOT NULL DEFAULT false,
  options     JSONB DEFAULT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  step        TEXT NOT NULL CHECK (step IN (
    'personal', 'christian_life', 'health', 'emergency'
  )),
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, field_key)
);

-- Index para busca rápida por evento
CREATE INDEX idx_event_form_fields_event_id ON public.event_form_fields(event_id);
CREATE INDEX idx_event_form_fields_default ON public.event_form_fields(is_default) WHERE event_id IS NULL;

-- RLS: leitura liberada para todos os usuários autenticados e anônimos
ALTER TABLE public.event_form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_form_fields_select_public"
  ON public.event_form_fields FOR SELECT
  USING (true);

CREATE POLICY "event_form_fields_insert_admin"
  ON public.event_form_fields FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "event_form_fields_update_admin"
  ON public.event_form_fields FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "event_form_fields_delete_admin"
  ON public.event_form_fields FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Grants
GRANT ALL ON public.event_form_fields TO authenticated;
GRANT SELECT ON public.event_form_fields TO anon;

-- ==============================================================
-- (3) Seed dos campos padrão (template global)
-- ==============================================================
INSERT INTO public.event_form_fields (event_id, field_key, field_type, label, placeholder, required, sort_order, step, is_default) VALUES
  -- DADOS PESSOAIS
  (NULL, 'full_name',            'text',     'Nome completo',         '',                        TRUE,   1,  'personal',       TRUE),
  (NULL, 'email',                'email',    'E-mail',                '',                        TRUE,   2,  'personal',       TRUE),
  (NULL, 'whatsapp',             'phone',    'WhatsApp',              '(21) 99999-9999',          TRUE,   3,  'personal',       TRUE),
  (NULL, 'birth_date',           'date',     'Data de nascimento',    '',                        FALSE,  4,  'personal',       TRUE),
  (NULL, 'gender',               'select',   'Gênero',                'Selecione...',            FALSE,  5,  'personal',       TRUE),
  (NULL, 'cpf',                  'cpf',      'CPF',                   '000.000.000-00',           FALSE,  6,  'personal',       TRUE),
  (NULL, 'rg',                   'text',     'RG',                    '',                        FALSE,  7,  'personal',       TRUE),
  (NULL, 'cep',                  'cep',      'CEP',                   '00000-000',                FALSE,  8,  'personal',       TRUE),
  (NULL, 'address',              'text',     'Endereço',              'Rua, número, bairro',      FALSE,  9,  'personal',       TRUE),
  (NULL, 'city',                 'text',     'Cidade',                '',                        FALSE,  10, 'personal',       TRUE),
  (NULL, 'state',                'text',     'Estado',                '',                        FALSE,  11, 'personal',       TRUE),

  -- VIDA CRISTÃ
  (NULL, 'is_christian',             'checkbox',  'Você se considera cristão(ã)?',        '',   FALSE, 12, 'christian_life', TRUE),
  (NULL, 'is_baptized',              'checkbox',  'É batizado(a)?',                       '',   FALSE, 13, 'christian_life', TRUE),
  (NULL, 'church',                   'text',      'Igreja',                               '',   FALSE, 14, 'christian_life', TRUE),
  (NULL, 'pastor',                   'text',      'Pastor',                               '',   FALSE, 15, 'christian_life', TRUE),
  (NULL, 'church_role',              'select',    'Cargo/função na igreja',               '',   FALSE, 16, 'christian_life', TRUE),
  (NULL, 'church_role_other',        'text',      'Qual cargo?',                          '',   FALSE, 17, 'christian_life', TRUE),
  (NULL, 'godparent',                'text',      'Nome do padrinho/madrinha',            '',   FALSE, 18, 'christian_life', TRUE),
  (NULL, 'godparent_contact',        'phone',     'Contato do padrinho/madrinha',         '(21) 99999-9999', FALSE, 19, 'christian_life', TRUE),
  (NULL, 'pastoral_authorization',   'checkbox',  'Autorização pastoral',                 '',   FALSE, 20, 'christian_life', TRUE),

  -- SAÚDE
  (NULL, 'health_info',           'textarea',  'Informações de saúde (alergias, medicações, condições)', '', FALSE, 21, 'health', TRUE),
  (NULL, 'has_allergies',         'checkbox',  'Possui alergias?',                      '',   FALSE, 22, 'health', TRUE),
  (NULL, 'allergy_description',   'text',      'Descreva as alergias',                  '',   FALSE, 23, 'health', TRUE),
  (NULL, 'dietary_restrictions',  'text',      'Restrições alimentares',                '',   FALSE, 24, 'health', TRUE),

  -- EMERGÊNCIA
  (NULL, 'emergency_contact',    'text',     'Nome do contato de emergência',           '',   FALSE, 25, 'emergency', TRUE),
  (NULL, 'emergency_phone',      'phone',    'Telefone de emergência',                  '(21) 99999-9999', FALSE, 26, 'emergency', TRUE),

  -- TERMOS
  (NULL, 'accept_terms',          'checkbox',  'Aceito os termos e condições do evento', '',  TRUE, 27, 'personal', TRUE);

-- Seed das opções dos selects
UPDATE public.event_form_fields SET options = '["Masculino","Feminino"]'::jsonb WHERE field_key = 'gender' AND event_id IS NULL;
UPDATE public.event_form_fields SET options = '["Pastor","Missionário","Diácono","Presbítero","Líder de Ministério","Obreiro","Membro","Congregado","Outro"]'::jsonb WHERE field_key = 'church_role' AND event_id IS NULL;

-- ==============================================================
-- (4) Coluna extra_fields em registrations
-- ==============================================================
ALTER TABLE public.registrations
  ADD COLUMN extra_fields JSONB DEFAULT '{}'::jsonb;
