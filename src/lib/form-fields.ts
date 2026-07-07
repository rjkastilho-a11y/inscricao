import { supabase } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { z } from 'zod';

// ─── Conditional Logic Types ────────────────────────────────────────────────

export type ComparisonOp =
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'is_empty' | 'not_empty'
  | 'gt' | 'lt' | 'gte' | 'lte';

export type ActionType =
  | 'show' | 'hide'
  | 'required' | 'optional'
  | 'auto_fill' | 'clear_on_hide'
  | 'enable' | 'disable' | 'readonly'
  | 'showStep' | 'hideStep'
  | 'setOptions' | 'showMessage';

export interface Condition {
  field_key: string;
  comparison: ComparisonOp;
  value: string;
}

export interface ConditionGroup {
  id: string;
  operator: 'AND' | 'OR';
  conditions: Condition[];
  actions: ActionType[];
  auto_fill_value?: string;
  message?: string;
}

export interface ConditionalLogic {
  enabled: boolean;
  groups: ConditionGroup[];
}

export const EMPTY_CONDITIONAL_LOGIC: ConditionalLogic = {
  enabled: false,
  groups: [],
};

export const COMPARISON_OPTIONS: { value: ComparisonOp; label: string }[] = [
  { value: 'equals', label: 'é igual a' },
  { value: 'not_equals', label: 'diferente de' },
  { value: 'contains', label: 'contém' },
  { value: 'not_contains', label: 'não contém' },
  { value: 'starts_with', label: 'começa com' },
  { value: 'ends_with', label: 'termina com' },
  { value: 'is_empty', label: 'está vazio' },
  { value: 'not_empty', label: 'não está vazio' },
  { value: 'gt', label: 'maior que' },
  { value: 'lt', label: 'menor que' },
  { value: 'gte', label: 'maior ou igual' },
  { value: 'lte', label: 'menor ou igual' },
];

export const ACTION_OPTIONS: { value: ActionType; label: string; group: string }[] = [
  { value: 'show', label: 'Mostrar este campo', group: 'Visibilidade' },
  { value: 'hide', label: 'Ocultar este campo', group: 'Visibilidade' },
  { value: 'required', label: 'Tornar obrigatório', group: 'Validação' },
  { value: 'optional', label: 'Tornar opcional', group: 'Validação' },
  { value: 'auto_fill', label: 'Definir valor automaticamente', group: 'Preenchimento' },
  { value: 'clear_on_hide', label: 'Limpar valor quando ocultado', group: 'Preenchimento' },
];

export const DB_COLUMNS: { value: string; label: string }[] = [
  { value: 'full_name', label: 'Nome completo' },
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'birth_date', label: 'Data de nascimento' },
  { value: 'gender', label: 'Gênero' },
  { value: 'perfil_fe', label: 'Perfil' },
  { value: 'is_baptized', label: 'É batizado' },
  { value: 'is_pastor', label: 'É pastor(a)?' },
  { value: 'church', label: 'Igreja' },
  { value: 'pastor', label: 'Pastor' },
  { value: 'church_role', label: 'Cargo/função na igreja' },
  { value: 'church_role_other', label: 'Outro cargo' },
  { value: 'godparent', label: 'Padrinho/madrinha' },
  { value: 'godparent_contact', label: 'Contato do padrinho/madrinha' },
  { value: 'pastoral_authorization', label: 'Autorização pastoral' },
  { value: 'health_info', label: 'Informações de saúde' },
  { value: 'emergency_contact', label: 'Contato de emergência' },
  { value: 'emergency_phone', label: 'Telefone de emergência' },
];

// ─── Field Types ────────────────────────────────────────────────────────────

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
  conditional_logic: ConditionalLogic | null;
  db_column: string | null;
}

export type FieldType = 'text' | 'email' | 'phone' | 'cpf' | 'cnpj' | 'cep' | 'date' | 'select' | 'checkbox' | 'textarea' | 'number' | 'gender';
export type FormStep = 'personal' | 'christian_life' | 'health' | 'emergency' | 'other' | 'payment';

export const STEP_LABELS: Record<FormStep, string> = {
  personal: 'Dados Pessoais',
  christian_life: 'Vida Cristã',
  health: 'Saúde',
  emergency: 'Emergência',
  other: 'Outros...',
  payment: 'Pagamento',
};

export const STEP_ORDER: FormStep[] = ['personal', 'christian_life', 'health', 'emergency', 'other'];

function parseFormRows(rows: Record<string, unknown>[]): FormField[] {
  return rows.map((row) => ({
    ...row,
    options: Array.isArray(row.options)
      ? row.options
      : typeof row.options === 'string'
        ? (() => { try { return JSON.parse(row.options as string); } catch { return []; } })()
        : [],
    conditional_logic: row.conditional_logic
      ? (typeof row.conditional_logic === 'string'
          ? (() => { try { return JSON.parse(row.conditional_logic as string); } catch { return null; } })()
          : row.conditional_logic) as ConditionalLogic | null
      : null,
    db_column: (row.db_column as string) || null,
  })) as FormField[];
}

export async function fetchFormFields(
  eventId: string,
  isCustom: boolean,
  disabledSteps?: FormStep[],
  showHidden?: boolean
): Promise<FormField[]> {
  try {
    const stepIndex = (s: FormStep) => STEP_ORDER.indexOf(s);
    let fields: FormField[];

    if (isCustom) {
      const query = supabase
        .from('event_form_fields')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true });

      if (!showHidden) query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      fields = parseFormRows((data || []) as Record<string, unknown>[]);
    } else {
      const [defaultResult, overrideResult] = await Promise.all([
        supabase
          .from('event_form_fields')
          .select('*')
          .is('event_id', null)
          .eq('is_default', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('event_form_fields')
          .select('*')
          .eq('event_id', eventId)
          .order('sort_order', { ascending: true }),
      ]);

      if (defaultResult.error) throw defaultResult.error;
      if (overrideResult.error) throw overrideResult.error;

      const fieldMap = new Map<string, Record<string, unknown>>();
      for (const f of (defaultResult.data || []) as Record<string, unknown>[]) {
        fieldMap.set(f.field_key as string, f);
      }
      for (const f of (overrideResult.data || []) as Record<string, unknown>[]) {
        fieldMap.set(f.field_key as string, f);
      }

      fields = parseFormRows(
        Array.from(fieldMap.values())
          .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      );

      if (!showHidden) {
        fields = fields.filter((f) => f.is_active);
      }
    }

    if (disabledSteps && disabledSteps.length > 0) {
      fields = fields.filter((f) => !disabledSteps.includes(f.step));
    }
    fields.sort((a, b) => stepIndex(a.step) - stepIndex(b.step) || a.sort_order - b.sort_order);
    return fields;
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
      conditional_logic: f.conditional_logic ?? null,
      db_column: f.db_column ?? null,
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

export async function fetchDefaultFieldsByStep(step: FormStep, _eventId: string): Promise<FormField[]> {
  try {
    const { data: defaults, error } = await supabase
      .from('event_form_fields')
      .select('*')
      .is('event_id', null)
      .eq('is_default', true)
      .eq('is_active', true)
      .eq('step', step)
      .order('sort_order');

    if (error) throw error;
    if (!defaults) return [];

    const seen = new Set<string>();
    return defaults.filter((f: any) => {
      if (seen.has(f.field_key)) return false;
      seen.add(f.field_key);
      return true;
    }) as FormField[];
  } catch (err) {
    console.error(`fetchDefaultFieldsByStep (${step}) error:`, err);
    return [];
  }
}

export async function copyDefaultFieldsByKeys(eventId: string, keys: string[]): Promise<FormField[]> {
  if (keys.length === 0) return [];
  try {
    const { data: existing } = await supabase
      .from('event_form_fields')
      .select('field_key')
      .eq('event_id', eventId);

    const existingKeys = new Set((existing ?? []).map((r: any) => r.field_key));
    const newKeys = keys.filter(k => !existingKeys.has(k));

    if (newKeys.length === 0) return [];

    const { data: defaults, error } = await supabase
      .from('event_form_fields')
      .select('*')
      .is('event_id', null)
      .eq('is_default', true)
      .in('field_key', newKeys);

    if (error) throw error;
    if (!defaults || defaults.length === 0) return [];

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
      conditional_logic: f.conditional_logic ?? null,
      db_column: f.db_column ?? null,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('event_form_fields')
      .upsert(copies, { onConflict: 'event_id,field_key', ignoreDuplicates: true })
      .select();
    if (insertError) throw insertError;

    return (inserted ?? []) as FormField[];
  } catch (err) {
    console.error('copyDefaultFieldsByKeys error:', err);
    return [];
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
    let validator: z.ZodTypeAny;

    if (field.field_type === 'checkbox' && field.options && field.options.length > 0) {
      if (field.required) {
        validator = z.array(z.string()).min(1, 'Selecione pelo menos uma opção');
      } else {
        validator = z.array(z.string()).optional();
      }
    } else if (field.required) {
      validator = REQUIRED_VALIDATORS[field.field_type] || z.string().min(1, 'Campo obrigatório');
    } else {
      validator = FIELD_VALIDATORS[field.field_type] || z.string().optional();
    }

    shape[field.field_key] = validator;
  }

  return z.object(shape);
}

export const KNOWN_COLUMNS = new Set([
  'full_name', 'email', 'whatsapp', 'birth_date', 'gender',
  'perfil_fe', 'is_baptized', 'is_pastor', 'church', 'pastor', 'church_role',
  'church_role_other', 'godparent', 'godparent_contact',
  'pastoral_authorization', 'health_info', 'emergency_contact',
  'emergency_phone', 'payment_method', 'payment_status',
  'paid_amount', 'private_notes', 'lot_id', 'invite_id',
  'cpf', 'rg', 'cep', 'address', 'city', 'state',
  'has_allergies', 'allergy_description', 'dietary_restrictions',
  'accept_terms', 'spouse_name', 'marital_status', 'wedding_date',
  'has_special_needs', 'special_needs_description',
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
    if (value === '' && field.field_type === 'date') continue;

    const finalValue =
      typeof value === 'string' && (field.field_type === 'text' || field.field_type === 'textarea')
        ? normalizeText(value)
        : typeof value === 'string' && field.field_type === 'email'
          ? value.trim().toLowerCase()
          : value;

    if (field.db_column) {
      columns[field.db_column] = finalValue;
    } else if (KNOWN_COLUMNS.has(field.field_key)) {
      columns[field.field_key] = finalValue;
    } else {
      extra[field.field_key] = finalValue;
    }
  }

  return { columns, extra };
}
