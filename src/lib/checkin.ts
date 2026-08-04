import { supabase } from '@/lib/supabase';

export function buildCheckinUrl(
  slug: string,
  checkinToken: string,
  registrationId: string
): string {
  return `${window.location.origin}/e/${slug}/checkin?token=${checkinToken}&reg=${registrationId}`;
}

export function buildComprovanteUrl(slug: string, registrationId: string): string {
  return `${window.location.origin}/e/${slug}/comprovante?reg=${registrationId}`;
}

export async function ensureCheckinToken(eventId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('events')
    .select('checkin_token')
    .eq('id', eventId)
    .maybeSingle();

  if (error) return null;
  if (data?.checkin_token) return data.checkin_token;

  const token = crypto.randomUUID();
  const { error: updateError } = await supabase
    .from('events')
    .update({ checkin_token: token })
    .eq('id', eventId);

  if (updateError) return null;
  return token;
}
