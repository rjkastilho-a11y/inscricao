-- ==============================================================
-- Kairós Events — Unicidade global de slug + check_slug_availability
-- Migration: 107_global_slug_uniqueness_and_availability
--
-- Contexto: a URL pública é global (/e/:slug), mas a unicidade do
-- slug era por igreja (church_id, slug). Dois eventos de igrejas
-- diferentes com o mesmo slug quebravam o hotsite público
-- (PostgREST .single() retorna 406 com 2 linhas).
--
-- Etapas:
--   1) Dedupe determinístico: entre eventos não-deletados com o
--      mesmo slug, mantém o mais antigo (created_at, id) e
--      sufixa os demais com -2, -3, ... .
--   2) Índice único global parcial: events_slug_unique passa a
--      ser sobre (slug) WHERE deleted_at IS NULL (permite recriar
--      o mesmo slug após soft-delete).
--   3) RPC check_slug_availability (SECURITY DEFINER) que ignora o
--      RLS de events (o frontend não enxerga outras igrejas) e
--      responde se o slug está livre, com opção de excluir o
--      próprio evento na edição.
-- ==============================================================

-- --------------------------------------------------------------
-- 1) DEDUPE DETERMINÍSTICO (antes de criar o índice global)
-- --------------------------------------------------------------
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM public.events
  WHERE deleted_at IS NULL
)
UPDATE public.events e
SET slug = e.slug || '-' || r.rn
FROM ranked r
WHERE r.id = e.id
  AND r.rn > 1;

-- --------------------------------------------------------------
-- 2) ÍNDICE ÚNICO GLOBAL (substitui o por igreja)
-- --------------------------------------------------------------
DROP INDEX IF EXISTS public.events_slug_unique;

CREATE UNIQUE INDEX events_slug_unique
  ON public.events(slug)
  WHERE deleted_at IS NULL;

-- --------------------------------------------------------------
-- 3) RPC check_slug_availability (ignora RLS, vê todas as igrejas)
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_slug_availability(
  p_slug TEXT,
  p_exclude_event_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE slug = p_slug
      AND deleted_at IS NULL
      AND (p_exclude_event_id IS NULL OR id <> p_exclude_event_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_slug_availability(TEXT, UUID) TO anon, authenticated;
