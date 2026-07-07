# Plan: Dynamic Spreadsheet Template, Import & Export

## Goal
Make the 3 spreadsheet features (template download, CSV import, CSV export) in the Registrations page dynamic based on the event's form fields (default or custom).

## File to modify
`src/pages/admin/RegistrationsPage.tsx`

## Step 1: Add imports

Add at line 20 (after the `useTrial` import):
```ts
import { fetchFormFields } from '@/lib/form-fields';
import type { FormField, FieldType } from '@/lib/form-fields';
```

## Step 2: Add FormMapping interface and helper function

After the `Registration` interface (line 49), add:

```ts
interface FormMapping {
  fields: FormField[];
  headers: string[];
  labelToField: Record<string, FormField>;
  keyToField: Record<string, FormField>;
  dbColumnToField: Record<string, FormField>;
  booleanFields: Set<string>;
  selectFields: Record<string, string[]>;
}

async function getFormMapping(eventId: string, isCustom: boolean): Promise<FormMapping> {
  const fields = await fetchFormFields(eventId, isCustom);
  const headers = fields.map((f) => f.label);
  const labelToField: Record<string, FormField> = {};
  const keyToField: Record<string, FormField> = {};
  const dbColumnToField: Record<string, FormField> = {};
  const booleanFields = new Set<string>();
  const selectFields: Record<string, string[]> = {};

  for (const f of fields) {
    labelToField[f.label] = f;
    keyToField[f.field_key] = f;
    if (f.db_column) dbColumnToField[f.db_column] = f;
    if (['checkbox'].includes(f.field_type) && (!f.options || f.options.length === 0)) {
      booleanFields.add(f.field_key);
    }
    if (f.options && f.options.length > 0) {
      selectFields[f.field_key] = f.options;
    }
  }

  return { fields, headers, labelToField, keyToField, dbColumnToField, booleanFields, selectFields };
}
```

## Step 3: Remove old static constants

Remove `TEMPLATE_HEADERS` (lines 151-158) and `CSV_MAP` (lines 160-182).

## Step 4: Rewrite `downloadTemplate()`

Replace lines 184-231 with a dynamic version that:
1. Calls `getFormMapping(eventId, event.is_custom)`
2. Adds fixed meta columns at the end: "Forma de Pagamento", "Status do Pagamento", "Observações", "Evento"
3. Generates Excel columns from field labels + meta columns
4. Adds a sample row with placeholder values per field_type:
   - text/phone/cpf/cnpj/cep: "Exemplo"
   - email: "email@exemplo.com"
   - date: "2000-01-15"
   - gender: "M"
   - select/checkbox with options: first option
   - boolean fields: "Sim"
   - number: "0"
   - textarea: "Observação de exemplo"
5. Adds dataValidations for:
   - select/checkbox fields with options -> list of options
   - gender field -> "M,F,other"
   - boolean fields -> "Sim,Não"
   - payment_method -> "PIX,Cartão de crédito,Dinheiro,Transferência,Outro"
   - payment_status -> "Pendente,Pago,Em atraso,Reembolsado"
6. Sets column width to 22

## Step 5: Rewrite `handleImport()`

Replace lines 252-325 with a dynamic version that:
1. Calls `getFormMapping(eventId, event.is_custom)`
2. Builds a dynamic CSV_MAP by iterating fields:
   - For each field, add mapping: label -> { field_key, db_column, field_type, options }
   - Also add reverse mapping: field_key -> same (so both label and key are accepted as CSV headers)
3. Also add fixed meta mappings: "Forma de Pagamento" -> payment_method, "Status do Pagamento" -> payment_status, "Observações" -> private_notes, "Evento" -> event_title
4. For each CSV row:
   - For each header in the CSV, find the matching field (by label or key)
   - Convert values based on field_type:
     - boolean/checkbox: "sim"/"true"/"1" -> true, else false
     - select: validate against options, store as string
     - gender: normalize "masculino"->"M", "feminino"->"F"
     - date: keep as-is (YYYY-MM-DD)
     - number: parse as number
     - everything else: string
   - Fields with db_column go to record[db_column]
   - Fields without db_column go to extra_data JSON
5. Keep existing validation: event_id required, full_name/email/whatsapp required

## Step 6: Rewrite `handleExport()`

Replace lines 327-382 with a dynamic version that:
1. Calls `getFormMapping(eventId, event.is_custom)`
2. Adds fixed meta headers at the end: "Método Pagamento", "Status Pagamento", "Valor Pago", "Observações", "% Pago", "Valor", "Criado em"
3. For each registration row:
   - For each form field, extract value by db_column from the record, or from extra_data
   - Format based on field_type:
     - boolean: "Sim"/"Não"
     - gender: "M" -> "Masculino", "F" -> "Feminino"
     - date: formatDate()
     - select with options: keep as-is
   - Add meta values at the end: payment_method, payment_status, paid_amount, private_notes, percentage, price, created_at
4. Generate CSV with proper escaping

## Verification
- Run `npm run build` to verify no TypeScript errors
- Run `npm run lint` if available
