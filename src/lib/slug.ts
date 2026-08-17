import { supabase } from '@/lib/supabase';

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function checkSlugAvailability(
  slug: string,
  excludeEventId?: string | null
): Promise<boolean> {
  if (!slug || slug.length < 3) return false;

  const { data, error } = await supabase.rpc('check_slug_availability', {
    p_slug: slug,
    p_exclude_event_id: excludeEventId ?? null,
  });

  if (error) return false;
  return Boolean(data);
}

const MAX_SLUG_TRIES = 50;

export async function getAvailableSlug(
  title: string,
  currentEventId?: string | null
): Promise<string> {
  const baseSlug = slugify(title) || 'evento';

  if (await checkSlugAvailability(baseSlug, currentEventId)) {
    return baseSlug;
  }

  for (let counter = 1; counter <= MAX_SLUG_TRIES; counter++) {
    const candidate = `${baseSlug}-${counter}`;
    if (await checkSlugAvailability(candidate, currentEventId)) {
      return candidate;
    }
  }

  throw new Error('Não foi possível gerar um slug disponível.');
}
