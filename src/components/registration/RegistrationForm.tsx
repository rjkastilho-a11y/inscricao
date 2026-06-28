import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registrationSchema, type RegistrationFormData } from '@/lib/validations';
import { maskPhone } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import type { FormField } from '@/lib/form-fields';
import { DynamicField } from '@/components/registration/DynamicField';
import { buildZodSchema, splitFieldValues } from '@/lib/form-fields';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertCircle, X, Loader2 } from 'lucide-react';

interface Props {
  isAdmin?: boolean;
  defaultValues?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  isLoading?: boolean;
  initialStep?: number;
  editing?: boolean;
  lotId?: string;
  lotPrice?: number;
  errorMessage?: string;
  onClearError?: () => void;
  errorActionLabel?: string;
  eventId?: string;
  fields?: FormField[];
  customMode?: boolean;
  termsText?: string | null;
}

const CHURCH_ROLES = [
  'Pastor', 'Pastor Auxiliar', 'Missionário', 'Diácono', 'Presbítero',
  'Líder de Ministério', 'Obreiro', 'Membro', 'Congregado', 'Outro',
];

const STEPS = ['Dados Pessoais', 'Vida Cristã', 'Saúde', 'Emergência', 'Pagamento'];

const STATIC_FIELD_KEYS = new Set([
  'full_name', 'email', 'whatsapp', 'birth_date', 'gender',
  'is_christian', 'is_baptized', 'church', 'pastor', 'church_role',
  'church_role_other', 'godparent', 'godparent_contact', 'pastoral_authorization',
  'health_info', 'emergency_contact', 'emergency_phone',
]);

export function RegistrationForm({ isAdmin = false, defaultValues, onSubmit, isLoading, initialStep, editing, lotId, lotPrice, errorMessage, onClearError, errorActionLabel, eventId, fields, customMode, termsText }: Props) {
  const [step, setStep] = useState(initialStep ?? 0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const schema = fields?.length
    ? customMode
      ? buildZodSchema(fields)
      : z.intersection(registrationSchema, buildZodSchema(fields))
    : registrationSchema;

  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      payment_method: 'pix',
      is_christian: false,
      pastoral_authorization: false,
      lot_id: lotId,
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (lotId) {
      form.setValue('lot_id', lotId);
    }
  }, [lotId, form]);

  useEffect(() => {
    if (step === 0) {
      setTimeout(() => document.getElementById('email')?.focus(), 100);
    }
  }, [step]);

  const isChristian = form.watch('is_christian');
  const churchRole = form.watch('church_role');

  const effectivePrice = lotPrice ?? 0;

  const renderStep = () => {
    switch (step) {
      case 0:
        if (customMode) {
          return (
            <div className="space-y-4">
              {fields?.filter((f) => f.step === 'personal').map((f) => (
                <DynamicField key={f.id} field={f} termsText={termsText} />
              ))}
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nome completo *</Label>
              <Input id="full_name" {...form.register('full_name')} />
              {form.formState.errors.full_name && (
                <p className="text-sm text-destructive mt-1">{String(form.formState.errors.full_name.message)}</p>
              )}
            </div>
            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">{String(form.formState.errors.email.message)}</p>
              )}
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input
                id="whatsapp"
                placeholder="(21) 99999-9999"
                {...form.register('whatsapp')}
                onChange={(e) => {
                  const masked = maskPhone(e.target.value);
                  form.setValue('whatsapp', masked);
                }}
              />
              {form.formState.errors.whatsapp && (
                <p className="text-sm text-destructive mt-1">{String(form.formState.errors.whatsapp.message)}</p>
              )}
            </div>
            <div>
              <Label htmlFor="birth_date">Data de nascimento</Label>
              <Input id="birth_date" type="date" {...form.register('birth_date')} />
            </div>
            <div>
              <Label htmlFor="gender">Gênero</Label>
              <Select onValueChange={(v) => form.setValue('gender', v as 'M' | 'F')}>
                <SelectTrigger id="gender">
                  <SelectValue>
                    {(value) => {
                      const labels: Record<string, string> = { M: 'Masculino', F: 'Feminino' };
                      return value ? (labels[value] || value) : 'Selecione...';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fields?.filter((f) => f.step === 'personal' && !STATIC_FIELD_KEYS.has(f.field_key)).map((f) => (
              <DynamicField key={f.id} field={f} termsText={termsText} />
            ))}
          </div>
        );

      case 1:
        if (customMode) {
          return (
            <div className="space-y-4">
              {fields?.filter((f) => f.step === 'christian_life').map((f) => (
                <DynamicField key={f.id} field={f} termsText={termsText} />
              ))}
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_christian"
                checked={isChristian}
                onCheckedChange={(v) => form.setValue('is_christian', !!v)}
              />
              <Label htmlFor="is_christian">Você se considera cristão(ã)?</Label>
            </div>

            {isChristian && (
              <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_baptized"
                    onCheckedChange={(v) => form.setValue('is_baptized', !!v)}
                  />
                  <Label htmlFor="is_baptized">É batizado(a)?</Label>
                </div>

                <div>
                  <Label htmlFor="church">Igreja *</Label>
                  <Input id="church" {...form.register('church')} />
                  {form.formState.errors.church && (
                    <p className="text-sm text-destructive mt-1">{String(form.formState.errors.church.message)}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="pastor">Pastor *</Label>
                  <Input id="pastor" {...form.register('pastor')} />
                  {form.formState.errors.pastor && (
                    <p className="text-sm text-destructive mt-1">{String(form.formState.errors.pastor.message)}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="church_role">Cargo/função na igreja *</Label>
                  <Select onValueChange={(v: string) => form.setValue('church_role', v)}>
                    <SelectTrigger id="church_role">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CHURCH_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.church_role && (
                    <p className="text-sm text-destructive mt-1">{String(form.formState.errors.church_role.message)}</p>
                  )}
                </div>

                {churchRole === 'Outro' && (
                  <div>
                    <Label htmlFor="church_role_other">Qual cargo? *</Label>
                    <Input id="church_role_other" {...form.register('church_role_other')} />
                    {form.formState.errors.church_role_other && (
                      <p className="text-sm text-destructive mt-1">{String(form.formState.errors.church_role_other.message)}</p>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="godparent">Nome do padrinho/madrinha</Label>
                  <Input id="godparent" placeholder="Nome completo" {...form.register('godparent')} />
                </div>

                <div>
                  <Label htmlFor="godparent_contact">Contato do padrinho/madrinha (WhatsApp)</Label>
                  <Input
                    id="godparent_contact"
                    placeholder="(21) 99999-9999"
                    {...form.register('godparent_contact')}
                    onChange={(e) => {
                      const masked = maskPhone(e.target.value);
                      form.setValue('godparent_contact', masked);
                    }}
                  />
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="pastoral_authorization"
                    onCheckedChange={(v) => form.setValue('pastoral_authorization', !!v)}
                  />
                  <Label htmlFor="pastoral_authorization" className="leading-relaxed">
                    Declaro que meu pastor/liderança está ciente e autoriza minha participação neste evento. *
                  </Label>
                </div>
                {form.formState.errors.pastoral_authorization && (
                  <p className="text-sm text-destructive">{String(form.formState.errors.pastoral_authorization.message)}</p>
                )}
                {fields?.filter((f) => f.step === 'christian_life' && !STATIC_FIELD_KEYS.has(f.field_key)).map((f) => (
                  <DynamicField key={f.id} field={f} termsText={termsText} />
                ))}
              </div>
            )}
          </div>
        );

      case 2:
        if (customMode) {
          return (
            <div className="space-y-4">
              {fields?.filter((f) => f.step === 'health').map((f) => (
                <DynamicField key={f.id} field={f} termsText={termsText} />
              ))}
            </div>
          );
        }
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="health_info">Informações de saúde (alergias, medicações, condições)</Label>
              <Textarea id="health_info" rows={4} {...form.register('health_info')} />
            </div>
            {fields?.filter((f) => f.step === 'health' && !STATIC_FIELD_KEYS.has(f.field_key)).map((f) => (
              <DynamicField key={f.id} field={f} termsText={termsText} />
            ))}
            {editing && (
              <>
                <hr className="border-border" />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contato de Emergência</h3>
                  <div>
                    <Label htmlFor="emergency_contact">Nome do contato de emergência</Label>
                    <Input id="emergency_contact" {...form.register('emergency_contact')} />
                  </div>
                  <div>
                    <Label htmlFor="emergency_phone">Telefone de emergência</Label>
                    <Input
                      id="emergency_phone"
                      placeholder="(21) 99999-9999"
                      {...form.register('emergency_phone')}
                      onChange={(e) => {
                        const masked = maskPhone(e.target.value);
                        form.setValue('emergency_phone', masked);
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 3:
        if (customMode) {
          return (
            <div className="space-y-4">
              {fields?.filter((f) => f.step === 'emergency').map((f) => (
                <DynamicField key={f.id} field={f} termsText={termsText} />
              ))}
            </div>
          );
        }
        if (editing) {
          return (
            <div className="space-y-6">
              <div>
                <Label htmlFor="health_info">Informações de saúde (alergias, medicações, condições)</Label>
                <Textarea id="health_info" rows={4} {...form.register('health_info')} />
              </div>
              {fields?.filter((f) => f.step === 'health' && !STATIC_FIELD_KEYS.has(f.field_key)).map((f) => (
                <DynamicField key={f.id} field={f} termsText={termsText} />
              ))}
              <hr className="border-border" />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contato de Emergência</h3>
                <div>
                  <Label htmlFor="emergency_contact">Nome do contato de emergência</Label>
                  <Input id="emergency_contact" {...form.register('emergency_contact')} />
                </div>
                <div>
                  <Label htmlFor="emergency_phone">Telefone de emergência</Label>
                  <Input
                    id="emergency_phone"
                    placeholder="(21) 99999-9999"
                    {...form.register('emergency_phone')}
                    onChange={(e) => {
                      const masked = maskPhone(e.target.value);
                      form.setValue('emergency_phone', masked);
                    }}
                  />
                </div>
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="emergency_contact">Nome do contato de emergência</Label>
              <Input id="emergency_contact" {...form.register('emergency_contact')} />
            </div>
            <div>
              <Label htmlFor="emergency_phone">Telefone de emergência</Label>
              <Input
                id="emergency_phone"
                placeholder="(21) 99999-9999"
                {...form.register('emergency_phone')}
                onChange={(e) => {
                  const masked = maskPhone(e.target.value);
                  form.setValue('emergency_phone', masked);
                }}
              />
            </div>
            {fields?.filter((f) => f.step === 'emergency' && !STATIC_FIELD_KEYS.has(f.field_key)).map((f) => (
              <DynamicField key={f.id} field={f} termsText={termsText} />
            ))}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            {effectivePrice > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                <span className="text-sm text-muted-foreground">Valor da inscrição: </span>
                <span className="text-xl font-bold text-foreground">R$ {effectivePrice.toFixed(2)}</span>
              </div>
            )}

            <div>
              <Label htmlFor="payment_method">Forma de pagamento *</Label>
              <Select
                defaultValue="pix"
                onValueChange={(v) => form.setValue('payment_method', v as any)}
              >
                <SelectTrigger id="payment_method">
                  <SelectValue>
                    {(value) => {
                      const labels: Record<string, string> = { pix: 'PIX', credit_card: 'Cartão de crédito', cash: 'Dinheiro', bank_transfer: 'Transferência', other: 'Outro' };
                      return value ? (labels[value] || value) : '';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit_card">Cartão de crédito</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="bank_transfer">Transferência</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <>
                <div>
                  <Label htmlFor="payment_status">Status do pagamento</Label>
                  <Select onValueChange={(v) => form.setValue('payment_status', v as any)}>
                    <SelectTrigger id="payment_status">
                      <SelectValue>
                        {(value) => {
                          const labels: Record<string, string> = { pending: 'Pendente', paid: 'Pago', overdue: 'Em atraso', refunded: 'Reembolsado', canceled: 'Cancelado' };
                          return value ? (labels[value] || value) : 'Selecione...';
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="overdue">Em atraso</SelectItem>
                      <SelectItem value="refunded">Reembolsado</SelectItem>
                      <SelectItem value="canceled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paid_amount">Valor pago (R$)</Label>
                  <Input
                    id="paid_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    {...form.register('paid_amount', { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="private_notes">Observações privadas (visível apenas admin)</Label>
                  <Textarea id="private_notes" rows={3} {...form.register('private_notes')} />
                </div>
              </>
            )}
          </div>
        );
    }
  };

  const isLastStep = step === STEPS.length - 1;

  const STEP_FIELD_MAP: Record<number, string[]> = {
    0: [],
    1: ['church', 'pastor', 'church_role', 'pastoral_authorization', 'church_role_other'],
    2: [],
    3: [],
  };

  const handleNext = async () => {
    const stepKey: Record<number, string> = { 0: 'personal', 1: 'christian_life', 2: 'health', 3: 'emergency' };
    let fieldsToValidate: string[] = [];

    if (customMode) {
      fieldsToValidate = fields
        ?.filter((f) => f.step === stepKey[step] && f.required)
        .map((f) => f.field_key) ?? [];
    } else {
      if (step === 0) {
        fieldsToValidate = ['full_name', 'email', 'whatsapp'];
      } else if (step === 1) {
        if (form.getValues('is_christian')) {
          fieldsToValidate = ['church', 'pastor', 'church_role', 'pastoral_authorization'];
          if (form.getValues('church_role') === 'Outro') {
            fieldsToValidate.push('church_role_other');
          }
        }
      }

      const dynamicKeys = fields
        ?.filter((f) => f.step === stepKey[step] && f.required)
        .map((f) => f.field_key) ?? [];

      fieldsToValidate.push(...dynamicKeys);
    }

    const valid = fieldsToValidate.length ? await form.trigger(fieldsToValidate as any) : true;
    if (!valid) return;

    if (step === 0 && eventId && !editing && !customMode) {
      const name = form.getValues('full_name');
      const email = form.getValues('email');
      setCheckingDuplicate(true);

      const { data } = await supabase
        .from('registrations')
        .select('full_name, email')
        .eq('event_id', eventId)
        .or(`full_name.ilike.${name},email.ilike.${email}`);

      setCheckingDuplicate(false);

      if (data && data.length > 0) {
        const nameLower = name.toLowerCase();
        const emailLower = email.toLowerCase();
        const hasName = data.some(r => r.full_name.toLowerCase() === nameLower);
        const hasEmail = data.some(r => r.email.toLowerCase() === emailLower);

        if (hasEmail && hasName) {
          setLocalError('Nome e e-mail já cadastrados neste evento.');
        } else if (hasEmail) {
          setLocalError('Este e-mail já está cadastrado neste evento.');
        } else if (hasName) {
          setLocalError('Este nome já está cadastrado neste evento.');
        }
        return;
      }
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const displayError = localError || errorMessage;
  const hasError = !!displayError;
  const showAction = !!(errorActionLabel || localError);
  const actionLabel = errorActionLabel || (localError ? 'Corrigir dados' : undefined);

  const clearError = () => {
    setLocalError(null);
    onClearError?.();
  };

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
      {hasError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-2">
            <p>{displayError}</p>
            {showAction && actionLabel && (
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setStep(0);
                }}
                className="rounded-md bg-destructive/20 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-destructive/30"
              >
                {actionLabel}
              </button>
            )}
          </div>
          {onClearError && (
            <button
              type="button"
              onClick={clearError}
              className="shrink-0 rounded p-0.5 transition-colors hover:bg-destructive/20"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex gap-1 flex-1">
          {STEPS.map((label, i) => (
            <div
              key={i}
              className={`h-2.5 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      <h2 className="font-semibold text-lg">
        {editing && (step === 2 || step === 3) ? 'Saúde & Emergência' : STEPS[step]}
      </h2>

      {renderStep()}

      <div className="flex justify-between pt-4">
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
          )}

        </div>
        <div className="ml-auto flex gap-2">
          {editing ? (
            <Button
              onClick={async () => {
                form.setValue('lot_id', lotId);
                const status = form.getValues('payment_status');
                if (status === 'refunded' || status === 'canceled') {
                  const valid = await form.trigger(['payment_method', 'payment_status', 'paid_amount']);
                  if (!valid) return;
                  await onSubmit(form.getValues());
                } else {
                  form.handleSubmit(onSubmit, () => {
                    toast.error('Verifique os campos obrigatórios.');
                  })();
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          ) : !isLastStep ? (
            <Button onClick={handleNext} disabled={checkingDuplicate}>
              {checkingDuplicate ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Verificando...</> : 'Continuar'}
            </Button>
          ) : (
            <Button
              onClick={() => {
                form.setValue('lot_id', lotId);
                form.handleSubmit(onSubmit, () => {
                  toast.error('Verifique os campos obrigatórios em todas as etapas.');
                })();
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Enviando...' : 'Confirmar inscrição'}
            </Button>
          )}
        </div>
      </div>
    </div>
    </FormProvider>
  );
}
