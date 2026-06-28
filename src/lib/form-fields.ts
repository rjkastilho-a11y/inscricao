import { supabase } from '@/lib/supabase';
import { z } from 'zod';

export interface FormField {
  id: string;
  event_id: string | null;
  field_key: string;
  field_type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
  options: string[] | null;
  sort_order: number;
  step: FormStep;
  is_default: boolean;
  is_active: boolean;
}

export type FieldType = 'text' | 'email' | 'phone' | 'cpf' | 'cnpj' | 'cep' | 'date' | 'select' | 'checkbox' | 'textarea' | 'number';
export type FormStep = 'personal' | 'christian_life' | 'health' | 'emergency';

export const STEP_LABELS: Record<FormStep, string> = {
  personal: 'Dados Pessoais',
  christian_life: 'Vida Cristã',
  health: 'Saúde',
  emergency: 'Emergência',
};

export const STEP_ORDER: FormStep[] = ['personal', 'christian_life', 'health', 'emergency'];

export async function fetchFormFields(eventId: string, isCustom: boolean): Promise<FormField[]> {
  try {
    const query = supabase
      .from('event_form_fields')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (isCustom) {
      query.eq('event_id', eventId);
    } else {
      query.is('event_id', null).eq('is_default', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('fetchFormFields error:', error.message);
      return [];
    }
    return (data as FormField[]) || [];
  } catch (err) {
    console.error('fetchFormFields exception:', err);
    return [];
  }
}

export async function copyDefaultFields(eventId: string): Promise<boolean> {
  try {
    const { data: defaults, error: fetchError } = await supabase
      .from('event_form_fields')
      .select('*')
      .is('event_id', null)
      .eq('is_default', true)
      .eq('is_active', true);

    if (fetchError) {
      console.error('copyDefaultFields fetch error:', fetchError.message);
      return false;
    }

    if (!defaults || defaults.length === 0) {
      console.warn('copyDefaultFields: no default fields found to copy');
      return false;
    }

    const copies = defaults.map((f: any) => ({
      event_id: eventId,
      field_key: f.field_key,
      field_type: f.field_type,
      label: f.label,
      placeholder: f.placeholder,
      required: f.required,
      options: f.options,
      sort_order: f.sort_order,
      step: f.step,
      is_default: false,
      is_active: true,
    }));

    const { error: insertError } = await supabase.from('event_form_fields').insert(copies);
    if (insertError) {
      console.error('copyDefaultFields insert error:', insertError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('copyDefaultFields exception:', err);
    return false;
  }
}

const FIELD_VALIDATORS: Record<string, z.ZodTypeAny> = {
  text: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  cep: z.string().optional(),
  date: z.string().optional(),
  select: z.string().optional(),
  checkbox: z.boolean().optional(),
  textarea: z.string().optional(),
  number: z.coerce.number().optional(),
};

const REQUIRED_VALIDATORS: Record<string, z.ZodTypeAny> = {
  text: z.string().min(1, 'Campo obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(1, 'Campo obrigatório'),
  cpf: z.string().min(1, 'Campo obrigatório'),
  cnpj: z.string().min(1, 'Campo obrigatório'),
  cep: z.string().min(1, 'Campo obrigatório'),
  date: z.string().min(1, 'Campo obrigatório'),
  select: z.string().min(1, 'Campo obrigatório'),
  checkbox: z.literal(true, { errorMap: () => ({ message: 'Campo obrigatório' }) }),
  textarea: z.string().min(1, 'Campo obrigatório'),
  number: z.coerce.number().min(1, 'Campo obrigatório'),
};

export function buildZodSchema(fields: FormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (field.required) {
      shape[field.field_key] = REQUIRED_VALIDATORS[field.field_type] || z.string().min(1, 'Campo obrigatório');
    } else {
      shape[field.field_key] = FIELD_VALIDATORS[field.field_type] || z.string().optional();
    }
  }

  return z.object(shape);
}

export const KNOWN_COLUMNS = new Set([
  'full_name', 'email', 'whatsapp', 'birth_date', 'gender',
  'is_christian', 'is_baptized', 'church', 'pastor', 'church_role',
  'church_role_other', 'godparent', 'godparent_contact',
  'pastoral_authorization', 'health_info', 'emergency_contact',
  'emergency_phone', 'payment_method', 'payment_status',
  'paid_amount', 'private_notes', 'lot_id', 'invite_id',
]);

export function splitFieldValues(
  data: Record<string, any>,
  fields: FormField[]
): { columns: Record<string, any>; extra: Record<string, any> } {
  const columns: Record<string, any> = {};
  const extra: Record<string, any> = {};

  for (const field of fields) {
    const value = data[field.field_key];
    if (value === undefined) continue;
    if (KNOWN_COLUMNS.has(field.field_key)) {
      columns[field.field_key] = value;
    } else {
      extra[field.field_key] = value;
    }
  }

  return { columns, extra };
}
