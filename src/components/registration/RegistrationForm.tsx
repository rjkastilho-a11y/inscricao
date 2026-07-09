import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registrationSchema, type RegistrationFormData } from '@/lib/validations';
import { maskPhone } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FormField, FormStep } from '@/lib/form-fields';
import { DynamicField } from '@/components/registration/DynamicField';
import { buildZodSchema, splitFieldValues } from '@/lib/form-fields';
import { computeAllStates } from '@/lib/conditional-logic';
import { findFieldStepIndex, parseDBErrorToFieldKey } from '@/lib/error-field-mapping';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertCircle, X, Loader2, CheckCircle, QrCode, CreditCard, Banknote, Building, ExternalLink, Ellipsis, Clock, CheckCircle2, Gift, Undo2, XCircle } from 'lucide-react';
import { PaymentHistory } from '@/components/registration/PaymentHistory';
import { CardSelector } from '@/components/ui/card-selector';
import type { PaymentRecord } from '@/lib/payments';

interface Props {
  isAdmin?: boolean;
  defaultValues?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  isLoading?: boolean;
  initialStep?: number;
  editing?: boolean;
  lotId?: string;
  lotPrice?: number;
  paymentLink?: string | null;
  errorMessage?: string;
  onClearError?: () => void;
  errorActionLabel?: string;
  eventId?: string;
  fields?: FormField[];
  customMode?: boolean;
  termsText?: string | null;
  payments?: PaymentRecord[];
  onRefreshPayments?: () => void;
  registrationId?: string;
  onAddPayment?: () => void;
  onPaymentMethodChange?: (value: string) => void;
  disabledSteps?: FormStep[];
}

const CHURCH_ROLES = [
  'Pastor', 'Pastor Auxiliar', 'Missionário', 'Diácono', 'Presbítero',
  'Líder de Ministério', 'Obreiro', 'Membro', 'Congregado', 'Outro',
];


const STATIC_FIELD_KEYS = new Set([
  'full_name', 'email', 'whatsapp', 'birth_date', 'gender',
  'perfil_fe', 'is_baptized', 'church', 'pastor', 'church_role',
  'church_role_other', 'godparent', 'godparent_contact', 'pastoral_authorization',
  'health_info', 'emergency_contact', 'emergency_phone',
]);

export function RegistrationForm({ isAdmin = false, defaultValues, onSubmit, isLoading, initialStep, editing, lotId, lotPrice, paymentLink, errorMessage, onClearError, errorActionLabel, eventId, fields, customMode, termsText, payments, onRefreshPayments, registrationId, onAddPayment, onPaymentMethodChange, disabledSteps }: Props) {
  const activeSteps = useMemo(() => {
    const allSteps = [
      { key: 0, label: 'Dados Pessoais', stepKey: 'personal' as FormStep },
      { key: 1, label: 'Vida Cristã', stepKey: 'christian_life' as FormStep },
      { key: 2, label: 'Saúde', stepKey: 'health' as FormStep },
      { key: 3, label: 'Emergência', stepKey: 'emergency' as FormStep },
      { key: 4, label: 'Outros...', stepKey: 'other' as FormStep },
      { key: 5, label: 'Pagamento', stepKey: 'payment' as FormStep },
    ];
    return allSteps.filter((s) => {
      if (s.key === 5) return true;
      if (disabledSteps?.includes(s.stepKey)) return false;
      if (!fields || fields.length === 0) return true;
      const stepsWithFields = new Set(fields.map((f) => f.step));
      return stepsWithFields.has(s.stepKey);
    });
  }, [fields, disabledSteps]);

  const [step, setStep] = useState(() => {
    if (!initialStep) return 0;
    const idx = activeSteps.findIndex(s => s.key === initialStep);
    return idx >= 0 ? idx : 0;
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [errorFieldKey, setErrorFieldKey] = useState<string | null>(null);

  const scrollToFieldKey = useCallback((fieldKey: string) => {
    const targetIdx = findFieldStepIndex(fieldKey, fields ?? []);
    if (targetIdx === -1) return;

    const targetStepIdx = activeSteps.findIndex((s) => s.key === targetIdx);
    if (targetStepIdx === -1) return;

    setStep(targetStepIdx);
    setTimeout(() => {
      const el = document.getElementById(fieldKey);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).focus?.();
      }
    }, 300);
  }, [fields, activeSteps]);

  const activeKeys = useMemo(() => {
    if (!fields) return STATIC_FIELD_KEYS;
    return new Set(fields.map((f) => f.field_key));
  }, [fields]);

  const fieldRequired = useCallback((key: string) => {
    return fields?.find((f) => f.field_key === key)?.required ?? true;
  }, [fields]);

  const schema = useMemo(() => {
    if (!fields?.length) return registrationSchema;
    if (customMode) return buildZodSchema(fields);

    return buildZodSchema(fields).superRefine((data, ctx) => {
      if (data.perfil_fe === 'Já sou cristão(ã)') {
        if (activeKeys.has('church') && fieldRequired('church') && !data.church) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Igreja obrigatória', path: ['church'] });
        }
        if (activeKeys.has('pastor') && fieldRequired('pastor') && !data.pastor) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pastor obrigatório', path: ['pastor'] });
        }
        if (activeKeys.has('church_role') && fieldRequired('church_role') && !data.church_role) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cargo obrigatório', path: ['church_role'] });
        }
        if (activeKeys.has('pastoral_authorization') && fieldRequired('pastoral_authorization') && !data.pastoral_authorization) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Autorização pastoral obrigatória', path: ['pastoral_authorization'] });
        }
        if (activeKeys.has('church_role_other') && data.church_role === 'Outro' && !data.church_role_other) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Descreva o cargo', path: ['church_role_other'] });
        }
      }
    });
  }, [fields, customMode, activeKeys]);

  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      payment_method: 'pix',
      perfil_fe: '',
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
      setTimeout(() => {
        const firstInput = document.querySelector<HTMLElement>('input, select, textarea');
        firstInput?.focus();
      }, 100);
    }
  }, [step]);

  useEffect(() => {
    if (!errorMessage) {
      setErrorFieldKey(null);
      return;
    }
    const key = parseDBErrorToFieldKey(errorMessage);
    if (key) {
      setErrorFieldKey(key);
      scrollToFieldKey(key);
    }
  }, [errorMessage, scrollToFieldKey]);

  const churchRole = form.watch('church_role');

  const watchedValues = useWatch({ control: form.control });

  const { fieldStates } = useMemo(
    () => computeAllStates(fields ?? [], watchedValues),
    [fields, watchedValues]
  );

  useEffect(() => {
    if (fields && fields.length > 0) {
      const fieldsWithCL = fields.filter(f => f.conditional_logic?.enabled);
      if (fieldsWithCL.length > 0) {
        console.log(`[RegistrationForm] ${fieldsWithCL.length} campos com lógica condicional habilitada:`);
        for (const f of fieldsWithCL) {
          const s = fieldStates.get(f.field_key);
          console.log(`  → ${f.field_key}: visible=${s?.visible}, required=${s?.required}, autoFill=${s?.autoFillValue}`);
        }
      }
    }
  }, [fields, fieldStates]);

  const effectivePrice = lotPrice ?? 0;

  const renderStep = () => {
    const currentStepKey = activeSteps[step]?.stepKey;

    if (customMode && currentStepKey !== 'payment') {
      return (
        <div className="space-y-4">
          {fields?.filter((f) => f.step === currentStepKey).map((f) => (
            <DynamicField key={f.id} field={f} state={fieldStates.get(f.field_key)} termsText={termsText} />
          ))}
        </div>
      );
    }

    switch (currentStepKey) {
      case 'personal':
        return (
          <div className="space-y-4">
            {activeKeys.has('full_name') && (
              <div>
                <Label htmlFor="full_name">Nome completo {fieldRequired('full_name') && '*'}</Label>
                <Input id="full_name" {...form.register('full_name')} />
                {form.formState.errors.full_name && (
                  <p className="text-sm text-destructive mt-1">{String(form.formState.errors.full_name.message)}</p>
                )}
              </div>
            )}
            {activeKeys.has('email') && (
              <div>
                <Label htmlFor="email">E-mail {fieldRequired('email') && '*'}</Label>
                <Input id="email" type="email" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1">{String(form.formState.errors.email.message)}</p>
                )}
              </div>
            )}
            {activeKeys.has('whatsapp') && (
              <div>
                <Label htmlFor="whatsapp">WhatsApp {fieldRequired('whatsapp') && '*'}</Label>
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
            )}
            {activeKeys.has('birth_date') && (
              <div>
                <Label htmlFor="birth_date">Data de nascimento</Label>
                <Input id="birth_date" type="date" {...form.register('birth_date')} />
              </div>
            )}
            {activeKeys.has('gender') && (
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
            )}
            {fields?.filter((f) => f.step === 'personal' && !STATIC_FIELD_KEYS.has(f.field_key)).map((f) => (
              <DynamicField key={f.id} field={f} state={fieldStates.get(f.field_key)} termsText={termsText} />
            ))}
          </div>
        );

      case 'christian_life':
        return (
          <div className="space-y-4">
            {fields?.filter((f) => f.step === 'christian_life').map((f) => (
              <DynamicField key={f.id} field={f} state={fieldStates.get(f.field_key)} termsText={termsText} />
            ))}
          </div>
        );

      case 'health':
        return (
          <div className="space-y-6">
            {activeKeys.has('health_info') && (
              <div>
                <Label htmlFor="health_info">Informações de saúde (alergias, medicações, condições)</Label>
                <Textarea id="health_info" rows={4} {...form.register('health_info')} />
              </div>
            )}
            {fields?.filter((f) => f.step === 'health' && !STATIC_FIELD_KEYS.has(f.field_key)).map((f) => (
              <DynamicField key={f.id} field={f} state={fieldStates.get(f.field_key)} termsText={termsText} />
            ))}
            {editing && (
              <>
                <hr className="border-border" />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contato de Emergência</h3>
                  {activeKeys.has('emergency_contact') && (
                    <div>
                      <Label htmlFor="emergency_contact">Nome do contato de emergência</Label>
                      <Input id="emergency_contact" {...form.register('emergency_contact')} />
                    </div>
                  )}
                  {activeKeys.has('emergency_phone') && (
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
                  )}
                </div>
              </>
            )}
          </div>
        );

      case 'emergency':
        if (editing) {
          return (
            <div className="space-y-6">
              {activeKeys.has('health_info') && (
                <div>
                  <Label htmlFor="health_info">Informações de saúde (alergias, medicações, condições)</Label>
                  <Textarea id="health_info" rows={4} {...form.register('health_info')} />
                </div>
              )}
            {fields?.filter((f) => f.step === 'health' && !STATIC_FIELD_KEYS.has(f.field_key)).map((f) => (
              <DynamicField key={f.id} field={f} state={fieldStates.get(f.field_key)} termsText={termsText} />
            ))}
              <hr className="border-border" />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contato de Emergência</h3>
                {activeKeys.has('emergency_contact') && (
                  <div>
                    <Label htmlFor="emergency_contact">Nome do contato de emergência</Label>
                    <Input id="emergency_contact" {...form.register('emergency_contact')} />
                  </div>
                )}
                {activeKeys.has('emergency_phone') && (
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
                )}
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            {activeKeys.has('emergency_contact') && (
              <div>
                <Label htmlFor="emergency_contact">Nome do contato de emergência</Label>
                <Input id="emergency_contact" {...form.register('emergency_contact')} />
              </div>
            )}
            {activeKeys.has('emergency_phone') && (
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
            )}
            {fields?.filter((f) => f.step === 'emergency' && !STATIC_FIELD_KEYS.has(f.field_key)).map((f) => (
              <DynamicField key={f.id} field={f} state={fieldStates.get(f.field_key)} termsText={termsText} />
            ))}
          </div>
        );

      case 'other':
        return (
          <div className="space-y-4">
            {fields?.filter((f) => f.step === 'other').map((f) => (
              <DynamicField key={f.id} field={f} state={fieldStates.get(f.field_key)} termsText={termsText} />
            ))}
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-4">
            {effectivePrice > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                <span className="text-sm text-muted-foreground">Valor da inscrição: </span>
                <span className="text-xl font-bold text-foreground">R$ {effectivePrice.toFixed(2)}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Forma de pagamento *</Label>
              <CardSelector
                columns={5}
                options={[
                  { value: 'pix', label: 'PIX', icon: QrCode },
                  { value: 'credit_card', label: 'Cartão de crédito', icon: CreditCard },
                  { value: 'cash', label: 'Dinheiro', icon: Banknote },
                  { value: 'bank_transfer', label: 'Transferência', icon: Building },
                  { value: 'other', label: 'Outro', icon: Ellipsis },
                  ...(paymentLink ? [{ value: 'external_link', label: 'Pagar online (Link externo)', icon: ExternalLink }] : []),
                ]}
                value={form.watch('payment_method') || 'pix'}
                onChange={(v) => {
                  form.setValue('payment_method', v as any);
                  onPaymentMethodChange?.(v as string);
                }}
              />
            </div>

            {form.watch('payment_method') === 'external_link' && paymentLink && (
              <p className="text-xs text-muted-foreground">
                Você será direcionado para o pagamento externo após confirmar a inscrição.
              </p>
            )}

            {isAdmin && (
              <>
                <div className="space-y-2">
                  <Label>Status do pagamento</Label>
                  <CardSelector
                    columns={5}
                    options={[
                      { value: 'pending', label: 'Pendente', icon: Clock },
                      { value: 'paid', label: 'Pago', icon: CheckCircle2 },
                      { value: 'cortesia', label: 'Cortesia', icon: Gift },
                      { value: 'refunded', label: 'Reembolsado', icon: Undo2 },
                      { value: 'canceled', label: 'Cancelado', icon: XCircle },
                    ]}
                    value={form.watch('payment_status') || ''}
                    onChange={(v) => form.setValue('payment_status', v as any)}
                  />
                </div>
                {isAdmin && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Histórico de Pagamentos</Label>
                      {onAddPayment && (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-emerald-600/80 text-white hover:bg-emerald-600"
                          onClick={onAddPayment}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Adicionar pagamento
                        </Button>
                      )}
                    </div>
                    {editing && registrationId && payments && onRefreshPayments && (
                      <PaymentHistory
                        payments={payments}
                        registrationId={registrationId}
                        onRefresh={onRefreshPayments}
                        paidAmount={form.watch('paid_amount')}
                        paymentMethod={form.watch('payment_method')}
                      />
                    )}
                  </div>
                )}
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

  const isLastStep = step === activeSteps.length - 1;

  const handleNext = async () => {
    let fieldsToValidate: string[] = [];

    if (customMode) {
      const currentStepKey = activeSteps[step]?.stepKey;
      fieldsToValidate = fields
        ?.filter((f) => {
          if (f.step !== currentStepKey) return false;
          const fieldState = fieldStates.get(f.field_key);
          const isVisible = fieldState?.visible ?? true;
          const isRequired = fieldState?.required ?? f.required;
          return isVisible && isRequired;
        })
        .map((f) => f.field_key) ?? [];
    } else {
      const currentStepKey = activeSteps[step]?.stepKey;
      if (step === 0) {
        fieldsToValidate = ['full_name', 'email', 'whatsapp'].filter((k) => activeKeys.has(k) && fieldRequired(k));
      } else if (step === 1) {
        if (form.getValues('perfil_fe') === 'Já sou cristão(ã)') {
          fieldsToValidate = ['church', 'pastor', 'church_role', 'pastoral_authorization'].filter((k) => activeKeys.has(k) && fieldRequired(k));
          if (form.getValues('church_role') === 'Outro') {
            if (activeKeys.has('church_role_other')) fieldsToValidate.push('church_role_other');
          }
        }
      }

      const dynamicKeys = fields
        ?.filter((f) => f.step === currentStepKey && f.required)
        .map((f) => f.field_key) ?? [];

      fieldsToValidate.push(...dynamicKeys);
    }

    const valid = fieldsToValidate.length ? await form.trigger(fieldsToValidate as any) : true;
    if (!valid) {
      const firstKey = fieldsToValidate.find((k) => form.formState.errors[k]);
      if (firstKey) {
        setErrorFieldKey(firstKey);
        setTimeout(() => {
          const el = document.getElementById(firstKey);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (el as HTMLElement).focus?.();
          }
        }, 100);
      }
      return;
    }

    // Validação customizada para campos obrigatórios por lógica condicional
    // (o schema Zod é estático e não sabe que o campo agora é obrigatório)
    if (customMode && fieldsToValidate.length > 0) {
      let hasCondError = false;
      for (const key of fieldsToValidate) {
        const val = form.getValues(key);
        const isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          form.setError(key as any, { message: 'Campo obrigatório' });
          hasCondError = true;
        }
      }
      if (hasCondError) return;
    }

    if (step === 0 && eventId && !editing && !customMode) {
      const name = activeKeys.has('full_name') ? form.getValues('full_name') : null;
      const email = activeKeys.has('email') ? form.getValues('email') : null;
      setCheckingDuplicate(true);

      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('full_name, email')
          .eq('event_id', eventId)
          .or(`full_name.ilike.${name},email.ilike.${email}`);

        if (error) throw error;

        if (data && data.length > 0 && (name || email)) {
          const nameLower = name?.toLowerCase();
          const emailLower = email?.toLowerCase();
          const hasName = nameLower ? data.some(r => r.full_name.toLowerCase() === nameLower) : false;
          const hasEmail = emailLower ? data.some(r => r.email.toLowerCase() === emailLower) : false;

          if (hasEmail && hasName) {
            setLocalError('Nome e e-mail já cadastrados neste evento.');
          } else if (hasEmail) {
            setLocalError('Este e-mail já está cadastrado neste evento.');
          } else if (hasName) {
            setLocalError('Este nome já está cadastrado neste evento.');
          }
          return;
        }
      } catch (err) {
        console.error('[RegistrationForm] Erro na verificação de duplicatas:', err);
      } finally {
        setCheckingDuplicate(false);
      }
    }

    setStep((s) => Math.min(s + 1, activeSteps.length - 1));
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
            {errorFieldKey && (
              <button
                type="button"
                onClick={() => {
                  clearError();
                  scrollToFieldKey(errorFieldKey);
                }}
                className="rounded-lg bg-destructive/20 px-3 py-1.5 text-xs font-medium underline transition-colors hover:bg-destructive/30"
              >
                Clique aqui para corrigir
              </button>
            )}
            {showAction && actionLabel && (
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setStep(0);
                }}
                className="rounded-lg bg-destructive/20 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-destructive/30"
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
          {activeSteps.map((s, i) => (
            <div
              key={s.key}
              className={`h-2.5 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {step + 1}/{activeSteps.length}
        </span>
      </div>

      <h2 className="font-semibold text-lg">
        {editing && activeSteps[step]?.stepKey === 'health' ? 'Saúde & Emergência' : activeSteps[step]?.label}
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
                  const valid = await form.trigger();
                  if (!valid) {
                    toast.error('Verifique os campos obrigatórios.');
                    return;
                  }
                  await onSubmit(form.getValues());
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
              onClick={async () => {
                form.setValue('lot_id', lotId);
                const valid = await form.trigger();
                if (!valid) {
                  const firstKey = Object.keys(form.formState.errors)[0];
                  if (firstKey) {
                    setErrorFieldKey(firstKey);
                    scrollToFieldKey(firstKey);
                  }
                  toast.error('Verifique os campos obrigatórios em todas as etapas.');
                  return;
                }
                await onSubmit(form.getValues());
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
