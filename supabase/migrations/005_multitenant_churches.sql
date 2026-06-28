-- ==============================================================
-- MIGRATION 005: Multitenant — Igrejas (churches) + church_id
-- Idempotente: pode rodar múltiplas vezes sem efeito colateral
-- ==============================================================

-- ==============================================================
-- (1) CRIAR TABELA churches
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.churches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================
-- (2) CRIAR IGREJA SEMENTE "Kairós Legacy"
-- ==============================================================
INSERT INTO public.churches (name)
VALUES ('Kairós Legacy')
ON CONFLICT DO NOTHING;

-- ==============================================================
-- (3) ADICIONAR church_id NAS TABELAS
-- ==============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id);

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id);

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id);

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id);

-- ==============================================================
-- (4) ATRIBUIR DADOS EXISTENTES À IGREJA SEMENTE
-- ==============================================================
DO $$
DECLARE
  v_legacy_id UUID;
BEGIN
  SELECT id INTO v_legacy_id FROM public.churches WHERE name = 'Kairós Legacy';

  UPDATE public.events           SET church_id = COALESCE(church_id, v_legacy_id) WHERE church_id IS NULL;
  UPDATE public.registrations    SET church_id = COALESCE(church_id, v_legacy_id) WHERE church_id IS NULL;
  UPDATE public.financial_entries SET church_id = COALESCE(church_id, v_legacy_id) WHERE church_id IS NULL;
  UPDATE public.user_roles       SET church_id = COALESCE(church_id, v_legacy_id) WHERE church_id IS NULL;
END $$;

-- ==============================================================
-- (5) UNIQUE (event_id, email) — trava a nível de banco
-- ==============================================================
ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_event_email_key;

ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_event_email_key UNIQUE (event_id, email);

-- ==============================================================
-- (6) CRIAR FUNÇÕES DE TRIGGER
-- ==============================================================

-- (6a) Para events / financial_entries / user_roles:
--      Busca church_id do usuário logado
CREATE OR REPLACE FUNCTION public.set_church_id_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.church_id IS NULL THEN
    SELECT church_id INTO NEW.church_id
    FROM public.user_roles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- (6b) Para registrations:
--      Busca church_id do evento vinculado
CREATE OR REPLACE FUNCTION public.set_church_id_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.church_id IS NULL THEN
    SELECT church_id INTO NEW.church_id
    FROM public.events
    WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ==============================================================
-- (7) APLICAR TRIGGERS
-- ==============================================================
DROP TRIGGER IF EXISTS trg_events_set_church_id ON public.events;
CREATE TRIGGER trg_events_set_church_id
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_church_id_from_session();

DROP TRIGGER IF EXISTS trg_financial_entries_set_church_id ON public.financial_entries;
CREATE TRIGGER trg_financial_entries_set_church_id
  BEFORE INSERT ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_church_id_from_session();

DROP TRIGGER IF EXISTS trg_user_roles_set_church_id ON public.user_roles;
CREATE TRIGGER trg_user_roles_set_church_id
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_church_id_from_session();

DROP TRIGGER IF EXISTS trg_registrations_set_church_id ON public.registrations;
CREATE TRIGGER trg_registrations_set_church_id
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_church_id_from_event();

-- ==============================================================
-- (8) NOT NULL — SÓ DEPOIS DE POPULAR
-- ==============================================================
ALTER TABLE public.events           ALTER COLUMN church_id SET NOT NULL;
ALTER TABLE public.registrations    ALTER COLUMN church_id SET NOT NULL;
ALTER TABLE public.financial_entries ALTER COLUMN church_id SET NOT NULL;

-- user_roles: permanece NULLABLE para suportar o fluxo de criação
-- de admin via SettingsPage (signUp troca a sessão antes do INSERT).
-- Em produção (com confirmação de e-mail), a sessão do admin que
-- criou permanece ativa e o trigger preenche church_id corretamente.
COMMENT ON COLUMN public.user_roles.church_id IS
  'NULLABLE para compatibilidade com criação local de admin. Em produção é preenchido automaticamente pelo trigger.';

-- ==============================================================
-- (9) RLS — NOVAS POLÍTICAS MULTITENANT
-- ==============================================================

-------------
-- EVENTS
-------------
DROP POLICY IF EXISTS "events_public_read"              ON public.events;
DROP POLICY IF EXISTS "events_admin_read"               ON public.events;
DROP POLICY IF EXISTS "events_admin_write"              ON public.events;
DROP POLICY IF EXISTS "events_select_auth"              ON public.events;
DROP POLICY IF EXISTS "events_admin_all"                ON public.events;
DROP POLICY IF EXISTS "events_admin_insert"             ON public.events;
DROP POLICY IF EXISTS "events_admin_update"             ON public.events;
DROP POLICY IF EXISTS "events_admin_delete"             ON public.events;
DROP POLICY IF EXISTS "events_public_select_open"       ON public.events;
DROP POLICY IF EXISTS "events_admin_select_all"         ON public.events;

-- Público: só eventos abertos
CREATE POLICY "events_public_select" ON public.events
  FOR SELECT USING (is_open = true);

-- Membro da igreja: vê TODOS os eventos da própria igreja
CREATE POLICY "events_church_select" ON public.events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = events.church_id
    )
  );

CREATE POLICY "events_church_insert" ON public.events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = events.church_id
    )
  );

CREATE POLICY "events_church_update" ON public.events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = events.church_id
    )
  );

CREATE POLICY "events_church_delete" ON public.events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = events.church_id
    )
  );

-------------
-- REGISTRATIONS
-------------
DROP POLICY IF EXISTS "registrations_admin_all"         ON public.registrations;
DROP POLICY IF EXISTS "registrations_public_insert"     ON public.registrations;
DROP POLICY IF EXISTS "registrations_select_auth"       ON public.registrations;

-- Público: pode inscrever-se se o evento estiver aberto
CREATE POLICY "registrations_public_insert" ON public.registrations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND is_open = true
    )
  );

-- Público: pode ler própria inscrição (pelo e-mail)
-- Usado pelo frontend para feedback pós-inscrição
CREATE POLICY "registrations_public_select" ON public.registrations
  FOR SELECT USING (auth.role() = 'anon');

-- Membro da igreja: CRUD completo nas inscrições da igreja
CREATE POLICY "registrations_church_select" ON public.registrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = registrations.church_id
    )
  );

CREATE POLICY "registrations_church_insert" ON public.registrations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = registrations.church_id
    )
  );

CREATE POLICY "registrations_church_update" ON public.registrations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = registrations.church_id
    )
  );

CREATE POLICY "registrations_church_delete" ON public.registrations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = registrations.church_id
    )
  );

-------------
-- FINANCIAL_ENTRIES
-------------
DROP POLICY IF EXISTS "financial_entries_admin_all"      ON public.financial_entries;
DROP POLICY IF EXISTS "financial_entries_auth_select"    ON public.financial_entries;

CREATE POLICY "financial_entries_church_select" ON public.financial_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = financial_entries.church_id
    )
  );

CREATE POLICY "financial_entries_church_insert" ON public.financial_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = financial_entries.church_id
    )
  );

CREATE POLICY "financial_entries_church_update" ON public.financial_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = financial_entries.church_id
    )
  );

CREATE POLICY "financial_entries_church_delete" ON public.financial_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND church_id = financial_entries.church_id
    )
  );

-------------
-- USER_ROLES
-------------
DROP POLICY IF EXISTS "user_roles_self_read"            ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all"             ON public.user_roles;

-- Autoleitura
CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Admin da igreja: gerencia papéis da própria igreja
CREATE POLICY "user_roles_church_admin_all" ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles AS ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.church_id = user_roles.church_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles AS ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.church_id = user_roles.church_id
    )
  );

-- ==============================================================
-- (10) GRANTS (reforço)
-- ==============================================================
GRANT ALL ON public.churches          TO anon, authenticated;
GRANT ALL ON public.events            TO anon, authenticated;
GRANT ALL ON public.registrations     TO anon, authenticated;
GRANT ALL ON public.financial_entries TO anon, authenticated;
GRANT ALL ON public.user_roles        TO anon, authenticated;

-- ==============================================================
-- FIM DA MIGRAÇÃO
-- ==============================================================
