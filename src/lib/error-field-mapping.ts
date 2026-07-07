import type { FormField, FormStep } from '@/lib/form-fields';

const STEP_KEYS: FormStep[] = ['personal', 'christian_life', 'health', 'emergency', 'other', 'payment'];

const STATIC_FIELD_STEP: Record<string, FormStep> = {
  full_name: 'personal', email: 'personal', whatsapp: 'personal',
  birth_date: 'personal', gender: 'personal',
  perfil_fe: 'christian_life', is_baptized: 'christian_life',
  is_pastor: 'christian_life',
  church: 'christian_life', pastor: 'christian_life',
  church_role: 'christian_life', church_role_other: 'christian_life',
  godparent: 'christian_life', godparent_contact: 'christian_life',
  pastoral_authorization: 'christian_life',
  health_info: 'health',
  emergency_contact: 'emergency', emergency_phone: 'emergency',
  payment_method: 'payment', payment_status: 'payment',
};

export function findFieldStepIndex(
  fieldKey: string,
  fields: FormField[],
): number {
  const stepKey = STATIC_FIELD_STEP[fieldKey]
    ?? fields.find((f) => f.field_key === fieldKey)?.step;
  if (!stepKey) return -1;
  return STEP_KEYS.indexOf(stepKey);
}

export function parseDBErrorToFieldKey(message: string): string | null {
  if (message.includes('null value in column')) {
    const match = message.match(/"([^"]+)"/);
    return match ? match[1] : null;
  }
  if (message.includes('invalid input syntax for type date')) {
    const match = message.match(/column "([^"]+)"/);
    return match ? match[1] : 'birth_date';
  }
  if (message.includes('invalid input value for enum')) {
    if (message.includes('payment_method')) return 'payment_method';
    if (message.includes('gender')) return 'gender';
    if (message.includes('payment_status')) return 'payment_status';
  }
  if (message.includes('violates foreign key constraint')) {
    const match = message.match(/Key \(([^)]+)\)/);
    return match ? match[1] : null;
  }
  return null;
}
