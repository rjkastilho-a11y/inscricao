import { memo, useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { maskPhone } from '@/lib/utils';
import { FileText } from 'lucide-react';
import type { FormField } from '@/lib/form-fields';
import type { FieldState } from '@/lib/conditional-logic';

interface Props {
  field: FormField;
  state?: FieldState;
  termsText?: string | null;
}

function DynamicFieldInner({ field, state, termsText }: Props) {
  const form = useFormContext();
  const [termsOpen, setTermsOpen] = useState(false);
  const prevVisibleRef = useRef(state?.visible ?? true);

  const error = form.formState.errors[field.field_key];
  const value = form.watch(field.field_key);

  // Debug: log state when present
  if (state && (state.autoFillValue || state.clearOnHide || state.disabled || state.readOnly || !state.visible)) {
    console.log(`[DynamicField] ${field.field_key} state:`, state);
  }

  // Aplica auto_fill quando o campo fica visível com um valor automático
  useEffect(() => {
    if (state?.autoFillValue !== undefined && state.visible) {
      const current = form.getValues(field.field_key);
      if (current !== state.autoFillValue) {
        console.log(`[DynamicField] auto_fill: ${field.field_key} = "${state.autoFillValue}"`);
        form.setValue(field.field_key, state.autoFillValue);
      }
    }
  }, [state?.autoFillValue, state?.visible, field.field_key, form]);

  // Limpa valor quando campo fica oculto (clear_on_hide)
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    const isNowVisible = state?.visible ?? true;
    prevVisibleRef.current = isNowVisible;

    if (wasVisible && !isNowVisible && state?.clearOnHide) {
      const current = form.getValues(field.field_key);
      if (current !== undefined && current !== null && current !== '') {
        console.log(`[DynamicField] clear_on_hide: ${field.field_key}`);
        form.setValue(field.field_key, undefined);
      }
    }
  }, [state?.visible, state?.clearOnHide, field.field_key, form]);

  if (state && !state.visible) return null;

  const effectiveRequired = state?.required ?? field.required;
  const isDisabled = state?.disabled ?? false;
  const isReadOnly = state?.readOnly ?? false;

  switch (field.field_type) {
    case 'textarea':
      return (
        <div>
          <Label htmlFor={field.field_key} className="mb-1.5">
            {field.label}
            {effectiveRequired && ' *'}
          </Label>
          <Textarea
            id={field.field_key}
            rows={4}
            disabled={isDisabled}
            readOnly={isReadOnly}
            {...form.register(field.field_key)}
          />
          {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
        </div>
      );

    case 'checkbox':
      if (field.field_key === 'accept_terms' && termsText) {
        return (
          <div>
            <div className="flex items-start space-x-2">
              <Checkbox
                id={field.field_key}
                checked={!!value}
                disabled={isDisabled}
                onCheckedChange={(v) => form.setValue(field.field_key, !!v)}
              />
              <Label htmlFor={field.field_key} className="leading-relaxed">
                {field.label}
                {effectiveRequired && ' *'}
              </Label>
            </div>
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="mt-1.5 ml-7 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <FileText className="size-3" />
              Ver termos e condições
            </button>
            {error && <p className="text-sm text-destructive ml-7">{error.message as string}</p>}

            <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
              <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-4xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
                <DialogHeader>
                  <DialogTitle>Termos e Condições</DialogTitle>
                </DialogHeader>
                <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed break-words">
                  {termsText}
                </div>
                <DialogFooter>
                  <Button onClick={() => {
                    form.setValue(field.field_key, true);
                    setTermsOpen(false);
                  }}>
                    Li e aceito
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );
      }

      if (field.options && field.options.length > 0) {
        const selected: string[] = Array.isArray(value) ? value : [];
        return (
          <div>
            <Label className="mb-1.5">
              {field.label}
              {effectiveRequired && ' *'}
            </Label>
            <div className="space-y-2">
              {field.options.map((opt) => {
                const optionId = `${field.field_key}-${opt}`;
                return (
                  <div key={opt} className="flex items-start space-x-2">
                    <Checkbox
                      id={optionId}
                      checked={selected.includes(opt)}
                      disabled={isDisabled}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...selected, opt]
                          : selected.filter((s) => s !== opt);
                        form.setValue(field.field_key, next);
                      }}
                    />
                    <Label htmlFor={optionId} className="leading-relaxed">{opt}</Label>
                  </div>
                );
              })}
            </div>
            {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
          </div>
        );
      }

      return (
        <div className="flex items-start space-x-2">
          <Checkbox
            id={field.field_key}
            checked={!!value}
            disabled={isDisabled}
            onCheckedChange={(v) => form.setValue(field.field_key, !!v)}
          />
          <Label htmlFor={field.field_key} className="leading-relaxed">
            {field.label}
            {effectiveRequired && ' *'}
          </Label>
          {error && <p className="text-sm text-destructive">{error.message as string}</p>}
        </div>
      );

    case 'gender':
    case 'select':
      return (
        <div>
          <Label htmlFor={field.field_key} className="mb-1.5">
            {field.label}
            {effectiveRequired && ' *'}
          </Label>
          <Select
            value={value || ''}
            onValueChange={(v) => form.setValue(field.field_key, v)}
            disabled={isDisabled}
          >
            <SelectTrigger id={field.field_key}>
              <SelectValue placeholder={field.placeholder || 'Selecione...'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
        </div>
      );

    case 'phone':
      return (
        <div>
          <Label htmlFor={field.field_key} className="mb-1.5">
            {field.label}
            {effectiveRequired && ' *'}
          </Label>
          <Input
            id={field.field_key}
            placeholder={field.placeholder}
            disabled={isDisabled}
            readOnly={isReadOnly}
            {...form.register(field.field_key)}
            onChange={(e) => {
              const masked = maskPhone(e.target.value);
              form.setValue(field.field_key, masked);
            }}
          />
          {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
        </div>
      );

    case 'date':
      return (
        <div>
          <Label htmlFor={field.field_key} className="mb-1.5">
            {field.label}
            {effectiveRequired && ' *'}
          </Label>
          <Input
            id={field.field_key}
            type="date"
            disabled={isDisabled}
            readOnly={isReadOnly}
            {...form.register(field.field_key)}
          />
          {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
        </div>
      );

    case 'number':
      return (
        <div>
          <Label htmlFor={field.field_key} className="mb-1.5">
            {field.label}
            {effectiveRequired && ' *'}
          </Label>
          <Input
            id={field.field_key}
            type="number"
            step="0.01"
            placeholder={field.placeholder}
            disabled={isDisabled}
            readOnly={isReadOnly}
            {...form.register(field.field_key, { valueAsNumber: true })}
          />
          {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
        </div>
      );

    default:
      return (
        <div>
          <Label htmlFor={field.field_key} className="mb-1.5">
            {field.label}
            {effectiveRequired && ' *'}
          </Label>
          <Input
            id={field.field_key}
            type={field.field_type === 'email' ? 'email' : 'text'}
            placeholder={field.placeholder}
            disabled={isDisabled}
            readOnly={isReadOnly}
            {...form.register(field.field_key)}
          />
          {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
        </div>
      );
  }
}

export const DynamicField = memo(DynamicFieldInner);
