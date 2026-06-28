import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { useEvent } from '@/contexts/EventContext';
import { Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import type { FormField, FieldType, FormStep } from '@/lib/form-fields';
import { STEP_LABELS, STEP_ORDER, fetchFormFields } from '@/lib/form-fields';
import { useTrial } from '@/components/layout/ChurchGuard';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'cep', label: 'CEP' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'textarea', label: 'Área de texto' },
  { value: 'number', label: 'Número' },
];

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  email: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  phone: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cpf: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  cnpj: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  cep: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  date: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  select: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  checkbox: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  textarea: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  number: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

interface FieldDraft {
  id?: string;
  event_id: string | null;
  field_key: string;
  field_type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
  options: string[];
  sort_order: number;
  step: FormStep;
  is_default: boolean;
  is_active: boolean;
  _dirty: boolean;
  _new?: boolean;
}

const EMPTY_FIELD = (step: FormStep, order: number): FieldDraft => ({
  event_id: null,
  field_key: '',
  field_type: 'text',
  label: '',
  placeholder: '',
  required: false,
  options: [],
  sort_order: order,
  step,
  is_default: false,
  is_active: true,
  _dirty: false,
  _new: true,
});

function toDraft(f: FormField): FieldDraft {
  return {
    ...f,
    options: f.options ?? [],
    _dirty: false,
  };
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getPlaceholderSuggestion(label: string, fieldType: FieldType): string {
  if (!label.trim()) return '';
  if (fieldType === 'date') return 'Selecione a data';
  if (fieldType === 'select') return 'Selecione...';
  if (fieldType === 'checkbox') return '';
  return `Digite aqui seu ${label[0].toLowerCase()}${label.slice(1)}`;
}

export default function FormBuilderPage() {
  const { eventId, event } = useEvent();
  const trial = useTrial();
  const [loading, setLoading] = useState(true);
  const [savingStep, setSavingStep] = useState<FormStep | null>(null);
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [editingField, setEditingField] = useState<FieldDraft | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStep, setEditStep] = useState<FormStep>('personal');
  const lastAutoPlaceholder = useRef('');

  const isCustom = event?.is_custom ?? false;

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      const data = await fetchFormFields(eventId, isCustom);
      setFields(data.map(toDraft));
      setLoading(false);
    };
    load();
  }, [eventId, isCustom]);

  const markDirty = (index: number, updates: Partial<FieldDraft>) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates, _dirty: true };
      return next;
    });
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const a = { ...next[index], _dirty: true, sort_order: next[target].sort_order };
      const b = { ...next[target], _dirty: true, sort_order: next[index].sort_order };
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  const toggleActive = (index: number) => {
    markDirty(index, { is_active: !fields[index].is_active });
  };

  const toggleRequired = (index: number) => {
    markDirty(index, { required: !fields[index].required });
  };

  const deleteField = (index: number) => {
    const field = fields[index];
    if (field.is_default) return;
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const openNewField = (step: FormStep) => {
    const stepFields = fields.filter((f) => f.step === step);
    const maxOrder = stepFields.reduce((max, f) => Math.max(max, f.sort_order), 0);
    const draft = EMPTY_FIELD(step, maxOrder + 1);
    setEditStep(step);
    setEditingField(draft);
    lastAutoPlaceholder.current = '';
    setDialogOpen(true);
  };

  const openEditField = (field: FieldDraft) => {
    setEditStep(field.step);
    setEditingField({ ...field });
    lastAutoPlaceholder.current = getPlaceholderSuggestion(field.label, field.field_type);
    setDialogOpen(true);
  };

  const saveFieldDraft = () => {
    if (!editingField) return;
    if (!editingField.label.trim() || !editingField.field_key.trim()) return;

    setFields((prev) => {
      const next = [...prev];
      if (editingField._new) {
        editingField._dirty = true;
        next.push(editingField);
      } else {
        const idx = next.findIndex((f) => f.id === editingField.id);
        if (idx >= 0) {
          next[idx] = { ...editingField, _dirty: true };
        }
      }
      return next;
    });

    setDialogOpen(false);
    setEditingField(null);
  };

  const saveStep = async (step: FormStep) => {
    if (!eventId) return;
    setSavingStep(step);

    try {
      const stepFields = fields.filter((f) => f.step === step);
      const dirty = stepFields.filter((f) => f._dirty);
      const newIds = new Set<string>();

      for (const field of dirty) {
        const payload = {
          event_id: eventId,
          field_key: field.field_key,
          field_type: field.field_type,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
          options: field.options.length > 0 ? field.options : null,
          sort_order: field.sort_order,
          step: field.step,
          is_default: false,
          is_active: field.is_active,
        };

        if (field._new) {
          const { data, error } = await supabase
            .from('event_form_fields')
            .insert(payload)
            .select('id');
          if (error) {
            console.error('Erro ao inserir campo:', error.message);
            return;
          }
          if (data?.[0]?.id) newIds.add(data[0].id);
        } else if (field.id) {
          const { error } = await supabase
            .from('event_form_fields')
            .update(payload)
            .eq('id', field.id);
          if (error) {
            console.error('Erro ao atualizar campo:', error.message);
            return;
          }
        }
      }

      const localIds = new Set([
        ...stepFields.filter((f) => f.id).map((f) => f.id!),
        ...newIds,
      ]);
      const { data: serverFields } = await supabase
        .from('event_form_fields')
        .select('id')
        .eq('event_id', eventId)
        .eq('step', step);

      const toDelete = (serverFields || [])
        .filter((sf) => !localIds.has(sf.id))
        .map((sf) => sf.id);

      if (toDelete.length > 0) {
        await supabase.from('event_form_fields').delete().in('id', toDelete);
      }

      const reload = await fetchFormFields(eventId, true);
      setFields(reload.map(toDraft));
    } catch (err) {
      console.error('saveStep exception:', err);
    } finally {
      setSavingStep(null);
    }
  };

  const groupedFields = STEP_ORDER.map((step) => ({
    step,
    label: STEP_LABELS[step],
    fields: fields
      .filter((f) => f.step === step)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  if (loading) {
    return (
      <div>
        <PageHeader title="Formulário de Inscrição" badge={event?.title} />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Editor de Formulário"
        description={isCustom ? 'Personalize os campos do formulário de inscrição.' : 'O evento usa o formulário padrão. Altere para "Personalizado" nas configurações para editar os campos.'}
      />

      {!isCustom ? (
        <Card className="bg-card backdrop-blur-md border-border shadow-lg">
          <CardContent className="pt-6 space-y-4">
            {groupedFields.map((group) => (
              <div key={group.step}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{group.label}</h3>
                <div className="space-y-2">
                  {group.fields.map((f) => (
                    <div key={f.id || f.field_key} className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
                      <GripVertical className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{f.label}</span>
                          {f.required && <span className="text-xs text-destructive">*</span>}
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${FIELD_TYPE_COLORS[f.field_type] || ''}`}>
                            {f.field_type}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{f.field_key}</p>
                      </div>
                      <Checkbox checked={f.is_active} disabled className="cursor-default" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedFields.map((group, gi) => (
            <Card key={group.step} className="bg-card backdrop-blur-md border-border shadow-lg">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</h3>
                  <Button variant="outline" size="sm" onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : () => openNewField(group.step)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Novo campo
                  </Button>
                </div>
                {group.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum campo neste passo.</p>
                ) : (
                  <div className="space-y-2">
                    {group.fields.map((f, fi) => {
                      const globalIndex = fields.findIndex((x) => x.id === f.id && x.field_key === f.field_key);
                      return (
                        <div
                          key={f.id || f.field_key}
                          className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                            f.is_active ? 'border-border bg-card' : 'border-border/40 bg-muted/20 opacity-60'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveField(globalIndex, -1)}
                              disabled={fi === 0}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveField(globalIndex, 1)}
                              disabled={fi === group.fields.length - 1}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{f.label || '(sem label)'}</span>
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${FIELD_TYPE_COLORS[f.field_type] || ''}`}>
                                {FIELD_TYPES.find((t) => t.value === f.field_type)?.label || f.field_type}
                              </span>
                              {!f.is_active && (
                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  Inativo
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{f.field_key}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id={`active-${f.id || f.field_key}`}
                                checked={f.is_active}
                                onCheckedChange={() => toggleActive(globalIndex)}
                              />
                              <Label htmlFor={`active-${f.id || f.field_key}`} className="text-xs cursor-pointer">Ativo</Label>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Checkbox
                                id={`required-${f.id || f.field_key}`}
                                checked={f.required}
                                onCheckedChange={() => toggleRequired(globalIndex)}
                              />
                              <Label htmlFor={`required-${f.id || f.field_key}`} className="text-xs cursor-pointer">Obrigatório</Label>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditField(f)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            {!f.is_default && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteField(globalIndex)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-2">
                  <Button
                    size="sm"
                    onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : () => saveStep(group.step)}
                    disabled={savingStep !== null || !group.fields.some((f) => f._dirty)}
                  >
                    {savingStep === group.step ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Salvando...</>
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingField?._new ? 'Novo campo' : 'Editar campo'}</DialogTitle>
          </DialogHeader>
          {editingField && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo *</Label>
                  <Select
                    value={editingField.field_type}
                    onValueChange={(v: FieldType) =>
                      setEditingField({ ...editingField, field_type: v, options: v === 'select' ? editingField.options : [] })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{FIELD_TYPES.find((t) => t.value === editingField.field_type)?.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Label *</Label>
                <Input
                  value={editingField.label}
                  onChange={(e) => {
                    const newLabel = e.target.value;
                    const suggestedPlaceholder = getPlaceholderSuggestion(newLabel, editingField.field_type);
                    const shouldUpdatePlaceholder =
                      !editingField.placeholder ||
                      editingField.placeholder === lastAutoPlaceholder.current;
                    if (shouldUpdatePlaceholder) {
                      lastAutoPlaceholder.current = suggestedPlaceholder;
                    }
                    setEditingField({
                      ...editingField,
                      label: newLabel,
                      placeholder: shouldUpdatePlaceholder ? suggestedPlaceholder : editingField.placeholder,
                      field_key: slugify(newLabel),
                    });
                  }}
                  placeholder="CPF do responsável"
                />
              </div>
              <div>
                <Label>Placeholder</Label>
                <Input
                  value={editingField.placeholder}
                  onChange={(e) => setEditingField({ ...editingField, placeholder: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              {editingField.field_type === 'select' && (
                <div>
                  <Label>Opções (uma por linha)</Label>
                  <Textarea
                    value={editingField.options.join('\n')}
                    onChange={(e) =>
                      setEditingField({
                        ...editingField,
                        options: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    rows={4}
                    placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                  />
                </div>
              )}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-required"
                    checked={editingField.required}
                    onCheckedChange={(v) => setEditingField({ ...editingField, required: !!v })}
                  />
                  <Label htmlFor="field-required">Obrigatório</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="field-active"
                    checked={editingField.is_active}
                    onCheckedChange={(v) => setEditingField({ ...editingField, is_active: !!v })}
                  />
                  <Label htmlFor="field-active">Ativo</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancelar</Button>} />
            <Button onClick={saveFieldDraft} disabled={!editingField?.label.trim() || !editingField?.field_key.trim()}>
              {editingField?._new ? 'Adicionar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
