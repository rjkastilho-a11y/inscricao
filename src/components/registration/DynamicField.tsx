import { memo, useState } from 'react';
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

interface Props {
  field: FormField;
  termsText?: string | null;
}

function DynamicFieldInner({ field, termsText }: Props) {
  const form = useFormContext();
  const [termsOpen, setTermsOpen] = useState(false);

  const error = form.formState.errors[field.field_key];
  const value = form.watch(field.field_key);

  switch (field.field_type) {
    case 'textarea':
      return (
        <div>
          <Label htmlFor={field.field_key}>
            {field.label}
            {field.required && ' *'}
          </Label>
          <Textarea
            id={field.field_key}
            rows={4}
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
                onCheckedChange={(v) => form.setValue(field.field_key, !!v)}
              />
              <Label htmlFor={field.field_key} className="leading-relaxed">
                {field.label}
                {field.required && ' *'}
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

      return (
        <div className="flex items-start space-x-2">
          <Checkbox
            id={field.field_key}
            checked={!!value}
            onCheckedChange={(v) => form.setValue(field.field_key, !!v)}
          />
          <Label htmlFor={field.field_key} className="leading-relaxed">
            {field.label}
            {field.required && ' *'}
          </Label>
          {error && <p className="text-sm text-destructive">{error.message as string}</p>}
        </div>
      );

    case 'select':
      return (
        <div>
          <Label htmlFor={field.field_key}>
            {field.label}
            {field.required && ' *'}
          </Label>
          <Select
            value={value || ''}
            onValueChange={(v) => form.setValue(field.field_key, v)}
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
          <Label htmlFor={field.field_key}>
            {field.label}
            {field.required && ' *'}
          </Label>
          <Input
            id={field.field_key}
            placeholder={field.placeholder}
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
          <Label htmlFor={field.field_key}>
            {field.label}
            {field.required && ' *'}
          </Label>
          <Input
            id={field.field_key}
            type="date"
            {...form.register(field.field_key)}
          />
          {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
        </div>
      );

    case 'number':
      return (
        <div>
          <Label htmlFor={field.field_key}>
            {field.label}
            {field.required && ' *'}
          </Label>
          <Input
            id={field.field_key}
            type="number"
            step="0.01"
            placeholder={field.placeholder}
            {...form.register(field.field_key, { valueAsNumber: true })}
          />
          {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
        </div>
      );

    default:
      return (
        <div>
          <Label htmlFor={field.field_key}>
            {field.label}
            {field.required && ' *'}
          </Label>
          <Input
            id={field.field_key}
            type={field.field_type === 'email' ? 'email' : 'text'}
            placeholder={field.placeholder}
            {...form.register(field.field_key)}
          />
          {error && <p className="text-sm text-destructive mt-1">{error.message as string}</p>}
        </div>
      );
  }
}

export const DynamicField = memo(DynamicFieldInner);
