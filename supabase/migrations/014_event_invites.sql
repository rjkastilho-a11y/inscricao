-- =============================================================
-- Kairós Events — Tabela event_invites
-- Migration: 014_event_invites
-- Descrição: Convites de uso único para inscrição em eventos
-- =============================================================

-- =============================================================
-- PARTE 1 — Tabela event_invites
-- =============================================================

CREATE TABLE IF NOT EXISTS public.event_invites (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token      TEXT        UNIQUE NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT false,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_invites IS 'Convites de uso único para inscrição em eventos. Cada token pode ser usado apenas uma vez.';
COMMENT ON COLUMN public.event_invites.token IS 'Token único e aleatório para o link de convite. Indexado para buscas rápidas.';
COMMENT ON COLUMN public.event_invites.used IS 'Indica se o convite já foi utilizado.';
COMMENT ON COLUMN public.event_invites.used_at IS 'Data/hora em que o convite foi utilizado.';

-- Index para buscas por token (login público via convite)
CREATE INDEX IF NOT EXISTS idx_event_invites_token ON public.event_invites (token);

-- Index para buscas por evento (listar convites de um evento)
CREATE INDEX IF NOT EXISTS idx_event_invites_event_id ON public.event_invites (event_id);

-- =============================================================
-- PARTE 2 — RLS (Row Level Security)
-- =============================================================

ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- ── Admin: selecionar convites do seu church ────────────────
CREATE POLICY "event_invites_admin_select" ON public.event_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.user_roles ur ON ur.church_id = e.church_id
      WHERE e.id = event_invites.event_id
        AND ur.user_id = auth.uid()
    )
  );

-- ── Admin: inserir convites do seu church ───────────────────
CREATE POLICY "event_invites_admin_insert" ON public.event_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.user_roles ur ON ur.church_id = e.church_id
      WHERE e.id = event_invites.event_id
        AND ur.user_id = auth.uid()
    )
  );

-- ── Admin: atualizar convites do seu church ─────────────────
CREATE POLICY "event_invites_admin_update" ON public.event_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.user_roles ur ON ur.church_id = e.church_id
      WHERE e.id = event_invites.event_id
        AND ur.user_id = auth.uid()
    )
  );

-- ── Admin: deletar convites do seu church ───────────────────
CREATE POLICY "event_invites_admin_delete" ON public.event_invites
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.user_roles ur ON ur.church_id = e.church_id
      WHERE e.id = event_invites.event_id
        AND ur.user_id = auth.uid()
    )
  );

-- ── Público: selecionar convite por token (para validação) ──
CREATE POLICY "event_invites_public_select_by_token" ON public.event_invites
  FOR SELECT USING (true);

-- =============================================================
-- PARTE 3 — Função auxiliar para validar e marcar convite
-- =============================================================

CREATE OR REPLACE FUNCTION public.use_event_invite(p_token TEXT)
RETURNS TABLE (
  p_invite_id   UUID,
  p_event_id    UUID,
  p_valid       BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id      UUID;
  v_ev_id   UUID;
  v_used    BOOLEAN;
BEGIN
  SELECT id, event_id, used
  INTO v_id, v_ev_id, v_used
  FROM public.event_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND OR v_used THEN
    p_invite_id := NULL;
    p_event_id  := NULL;
    p_valid     := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.event_invites
  SET used = true, used_at = now()
  WHERE id = v_id;

  p_invite_id := v_id;
  p_event_id  := v_ev_id;
  p_valid     := TRUE;
  RETURN NEXT;
END;
$$;
