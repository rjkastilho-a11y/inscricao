-- ==============================================================
-- MIGRAÇÃO 038: Soft delete + proteção contra deleção acidental
--
-- 1. Adiciona deleted_at em events, registrations, churches
-- 2. Troca ON DELETE CASCADE por ON DELETE RESTRICT em FKs críticas
-- 3. Adiciona função de soft delete
-- 4. Atualiza RLS para filtrar registros deletados
-- ==============================================================

-- ==============================================================
-- (1) ADICIONAR deleted_at NAS TABELAS CRÍTICAS
-- ==============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índice para queries que filtram registros não-deletados
CREATE INDEX IF NOT EXISTS idx_events_not_deleted
  ON public.events (deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_not_deleted
  ON public.registrations (deleted_at) WHERE deleted_at IS NULL;

-- ==============================================================
-- (2) TROCAR ON DELETE CASCADE POR ON DELETE RESTRICT
-- ==============================================================

-- registrations → events: não deletar evento se tem inscrições
ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_event_id_fkey,
  ADD CONSTRAINT registrations_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id)
    ON DELETE RESTRICT;

-- payments → registrations: não deletar inscrição se tem pagamentos
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_registration_id_fkey,
  ADD CONSTRAINT payments_registration_id_fkey
    FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
    ON DELETE RESTRICT;

-- group_assignments → events
ALTER TABLE public.group_assignments
  DROP CONSTRAINT IF EXISTS group_assignments_event_id_fkey,
  ADD CONSTRAINT group_assignments_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id)
    ON DELETE RESTRICT;

-- event_invites → events
ALTER TABLE public.event_invites
  DROP CONSTRAINT IF EXISTS event_invites_event_id_fkey,
  ADD CONSTRAINT event_invites_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id)
    ON DELETE RESTRICT;

-- event_lots → events
ALTER TABLE public.event_lots
  DROP CONSTRAINT IF EXISTS event_lots_event_id_fkey,
  ADD CONSTRAINT event_lots_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id)
    ON DELETE RESTRICT;

-- event_form_fields → events (mantém CASCADE pois campos são descartados com evento)
-- OFFERINGS e EXPENSES → events
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offerings_event_id_fkey') THEN
    ALTER TABLE public.offerings
      DROP CONSTRAINT offerings_event_id_fkey,
      ADD CONSTRAINT offerings_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.events(id)
        ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_event_id_fkey') THEN
    ALTER TABLE public.expenses
      DROP CONSTRAINT expenses_event_id_fkey,
      ADD CONSTRAINT expenses_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.events(id)
        ON DELETE RESTRICT;
  END IF;
END;
$$;

-- ==============================================================
-- (3) FUNÇÃO DE SOFT DELETE
-- ==============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_event(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário tem permissão (admin da igreja do evento)
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
  ) THEN
    RAISE EXCEPTION 'Sem permissão para deletar este evento';
  END IF;

  -- Verificar se há inscrições ativas
  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE event_id = p_event_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Não é possível deletar evento com inscrições ativas. Cancele as inscrições primeiro.';
  END IF;

  -- Soft delete
  UPDATE public.events
  SET deleted_at = now()
  WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_event(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND e.church_id = (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid
  ) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar este evento';
  END IF;

  UPDATE public.events
  SET deleted_at = NULL
  WHERE id = p_event_id;
END;
$$;

-- ==============================================================
-- (4) ATUALIZAR RLS PARA FILTRAR DELETADOS
-- ==============================================================

-- Events: filtrar deletados nas políticas de leitura
DROP POLICY IF EXISTS "events_church_isolation" ON public.events;
CREATE POLICY "events_church_isolation" ON public.events
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id
    AND deleted_at IS NULL
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id
  );

DROP POLICY IF EXISTS "events_public_read" ON public.events;
CREATE POLICY "events_public_read" ON public.events
  FOR SELECT
  TO anon
  USING (is_open = true AND deleted_at IS NULL);

-- Registrations: filtrar deletados
DROP POLICY IF EXISTS "registrations_church_select" ON public.registrations;
CREATE POLICY "registrations_church_select" ON public.registrations
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'church_id')::uuid = church_id
    AND deleted_at IS NULL
  );

-- ==============================================================
-- FIM DA MIGRAÇÃO 038
-- ==============================================================
