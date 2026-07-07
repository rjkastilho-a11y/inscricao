-- ==============================================================
-- MIGRAÇÃO 076: Slug único parcial (ignora soft-delete)
--
-- Substitui a constraint UNIQUE em events.slug por um índice
-- único parcial que considera apenas eventos não deletados.
-- Isso permite recriar um evento com o mesmo slug de um
-- evento soft-deletado.
-- ==============================================================

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_slug_key;

CREATE UNIQUE INDEX events_slug_unique ON public.events(church_id, slug) WHERE deleted_at IS NULL;
