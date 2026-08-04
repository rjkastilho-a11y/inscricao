import { supabase } from '@/lib/supabase';

interface LotRow {
  name: string;
  description: string | null;
  price: number;
  start_date: string;
  end_date: string;
  max_capacity: number | null;
}

interface FieldRow {
  field_key: string;
  field_type: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: unknown;
  sort_order: number;
  step: string;
  is_active: boolean;
  conditional_logic: unknown;
  db_column: string | null;
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(churchId: string, baseTitle: string): Promise<string> {
  const base = slugify(baseTitle) || 'evento';
  let slug = base;
  let suffix = 2;
  for (;;) {
    const { data } = await supabase
      .from('events')
      .select('id')
      .eq('church_id', churchId)
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function duplicateEvent(
  sourceEventId: string,
  newTitle: string
): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    const { data: source, error: sourceError } = await supabase
      .from('events')
      .select('*')
      .eq('id', sourceEventId)
      .single();

    if (sourceError || !source) {
      return { ok: false, error: sourceError?.message || 'Evento origem não encontrado.' };
    }

    const title = newTitle.trim();
    if (title.length < 3) {
      return { ok: false, error: 'O título deve ter pelo menos 3 caracteres.' };
    }

    const slug = await generateUniqueSlug(source.church_id, title);

    const newEvent: Record<string, unknown> = {
      ...source,
      title,
      slug,
      checkin_token: source.checkin_token ? crypto.randomUUID() : null,
      deleted_at: null,
    };
    delete newEvent.id;
    delete newEvent.created_at;
    delete newEvent.updated_at;

    const { data: created, error: insertError } = await supabase
      .from('events')
      .insert(newEvent)
      .select()
      .single();

    if (insertError || !created) {
      return { ok: false, error: insertError?.message || 'Erro ao criar o evento duplicado.' };
    }

    const newEventId = created.id;

    const cleanup = async () => {
      try {
        await supabase.rpc('soft_delete_event', { p_event_id: newEventId });
      } catch {
        // best effort
      }
    };

    const { data: lots, error: lotsError } = await supabase
      .from('event_lots')
      .select('*')
      .eq('event_id', sourceEventId);

    if (lotsError) {
      await cleanup();
      return { ok: false, error: 'Erro ao ler os lotes do evento origem.' };
    }

    if (lots && lots.length > 0) {
      const lotsToInsert = lots.map((lot: LotRow) => ({
        event_id: newEventId,
        name: lot.name,
        description: lot.description || null,
        price: lot.price,
        start_date: lot.start_date,
        end_date: lot.end_date,
        max_capacity: lot.max_capacity ?? null,
      }));

      const { error: lotsInsertError } = await supabase.from('event_lots').insert(lotsToInsert);
      if (lotsInsertError) {
        await cleanup();
        return { ok: false, error: 'Erro ao copiar os lotes: ' + lotsInsertError.message };
      }
    }

    const { data: fields, error: fieldsError } = await supabase
      .from('event_form_fields')
      .select('*')
      .eq('event_id', sourceEventId);

    if (fieldsError) {
      await cleanup();
      return { ok: false, error: 'Erro ao ler os campos do formulário do evento origem.' };
    }

    if (fields && fields.length > 0) {
      const fieldsToInsert = fields.map((f: FieldRow) => ({
        event_id: newEventId,
        field_key: f.field_key,
        field_type: f.field_type,
        label: f.label,
        placeholder: f.placeholder ?? '',
        required: f.required,
        options: f.options ?? null,
        sort_order: f.sort_order,
        step: f.step,
        is_default: false,
        is_active: f.is_active,
        conditional_logic: f.conditional_logic ?? null,
        db_column: f.db_column ?? null,
      }));

      const { error: fieldsInsertError } = await supabase
        .from('event_form_fields')
        .insert(fieldsToInsert);
      if (fieldsInsertError) {
        await cleanup();
        return { ok: false, error: 'Erro ao copiar o formulário: ' + fieldsInsertError.message };
      }
    }

    return { ok: true, eventId: newEventId };
  } catch (err) {
    console.error('duplicateEvent exception:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Erro inesperado ao duplicar o evento.' };
  }
}
