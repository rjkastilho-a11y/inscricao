import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

import { useEvent } from '@/contexts/EventContext';
import { Loader2, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import type { FormField, FieldType, FormStep, ConditionalLogic } from '@/lib/form-fields';
import { STEP_LABELS, STEP_ORDER, fetchFormFields, copyDefaultFields, fetchDefaultFieldsByStep, copyDefaultFieldsByKeys } from '@/lib/form-fields';
import { useTrial } from '@/components/layout/ChurchGuard';
import { ConditionalLogicBuilder } from '@/components/admin/ConditionalLogicBuilder';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  { value: 'gender', label: 'Gênero' },
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
  conditional_logic: ConditionalLogic | null;
  db_column: string | null;
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
  conditional_logic: null,
  db_column: null,
  _dirty: false,
  _new: true,
});

function toDraft(f: FormField): FieldDraft {
  return {
    ...f,
    options: f.options ?? [],
    conditional_logic: f.conditional_logic ?? null,
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

function FieldCard({
  f,
  mode = 'custom',
  onToggleActive,
  onToggleRequired,
  onEdit,
  onDelete,
}: {
  f: FieldDraft;
  mode?: 'default' | 'custom';
  onToggleActive: () => void;
  onToggleRequired: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id || f.field_key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        f.is_active ? 'border-border bg-card' : 'border-border/40 bg-muted/20 opacity-60'
      } ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
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
          {f.db_column && (
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {f.db_column}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{f.field_key}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Switch checked={f.is_active} onCheckedChange={onToggleActive} />
          <Label className="text-xs cursor-pointer text-muted-foreground">Ativo</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`required-${f.id || f.field_key}`} checked={f.required} onCheckedChange={onToggleRequired} />
          <Label htmlFor={`required-${f.id || f.field_key}`} className="text-xs cursor-pointer">Obrigatório</Label>
        </div>
        {mode === 'custom' && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit!}>
              <Pencil className="size-3.5" />
            </Button>
            {!f.is_default && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete!}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
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
  const [dialogMode, setDialogMode] = useState<'default' | 'custom'>('default');
  const [defaultFields, setDefaultFields] = useState<FormField[]>([]);
  const [selectedDefaultKeys, setSelectedDefaultKeys] = useState<string[]>([]);
  const [defaultSearch, setDefaultSearch] = useState('');
  const lastAutoPlaceholder = useRef('');
  const [stepPersonal, setStepPersonal] = useState(true);
  const [stepChristianLife, setStepChristianLife] = useState(true);
  const [stepHealth, setStepHealth] = useState(true);
  const [stepEmergency, setStepEmergency] = useState(true);
  const [stepOther, setStepOther] = useState(true);
  const [savingStepToggle, setSavingStepToggle] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const isCustom = event?.is_custom ?? false;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeKey = String(active.id);
    const overKey = String(over.id);

    setFields((prev) => {
      const activeField = prev.find((f) => (f.id || f.field_key) === activeKey);
      const overField = prev.find((f) => (f.id || f.field_key) === overKey);
      if (!activeField || !overField || activeField.step !== overField.step) return prev;

      const step = activeField.step;
      const stepFields = prev.filter((f) => f.step === step);
      const otherFields = prev.filter((f) => f.step !== step);

      const activeIndex = stepFields.findIndex((f) => (f.id || f.field_key) === activeKey);
      const overIndex = stepFields.findIndex((f) => (f.id || f.field_key) === overKey);

      const reordered = arrayMove(stepFields, activeIndex, overIndex);
      const updated = reordered.map((f, i) => ({
        ...f,
        sort_order: i + 1,
        _dirty: f.sort_order !== (i + 1),
      }));

      return [...otherFields, ...updated];
    });
  }, []);

  const handleDragEndDefault = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !eventId) return;

    const activeKey = String(active.id);
    const overKey = String(over.id);

    const activeField = fields.find((f) => (f.id || f.field_key) === activeKey);
    const overField = fields.find((f) => (f.id || f.field_key) === overKey);
    if (!activeField || !overField || activeField.step !== overField.step) return;

    const step = activeField.step;
    const stepFields = fields.filter((f) => f.step === step);
    const otherFields = fields.filter((f) => f.step !== step);

    const activeIndex = stepFields.findIndex((f) => (f.id || f.field_key) === activeKey);
    const overIndex = stepFields.findIndex((f) => (f.id || f.field_key) === overKey);

    const reordered = arrayMove(stepFields, activeIndex, overIndex);
    const updated = reordered.map((f, i) => ({ ...f, sort_order: i + 1 }));

    setFields([...otherFields, ...updated]);

    for (const f of updated) {
      const { error } = await supabase
        .from('event_form_fields')
        .upsert({
          event_id: eventId,
          field_key: f.field_key,
          field_type: f.field_type,
          label: f.label,
          placeholder: f.placeholder,
          required: f.required,
          options: f.options.length > 0 ? f.options : null,
          sort_order: f.sort_order,
          step: f.step,
          is_default: false,
          is_active: f.is_active,
          conditional_logic: f.conditional_logic?.enabled ? f.conditional_logic : null,
          db_column: f.db_column || null,
        }, { onConflict: 'event_id,field_key,step' });
      if (error) {
        console.error('Erro ao salvar ordem:', error.message);
      }
    }

    const data = await fetchFormFields(eventId, false, undefined, true);
    setFields(data.map(toDraft));
  }, [fields, eventId]);

  useEffect(() => {
    if (event) {
      setStepPersonal(event.step_personal ?? true);
      setStepChristianLife(event.step_christian_life ?? true);
      setStepHealth(event.step_health ?? true);
      setStepEmergency(event.step_emergency ?? true);
      setStepOther(event.step_other ?? true);
    }
  }, [event]);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      const data = await fetchFormFields(eventId, isCustom, undefined, true);
      const seen = new Set<string>();
      setFields(data.map(toDraft).filter((f) => {
        const key = `${f.field_key}::${f.step}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
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

  const toggleActive = (index: number) => {
    markDirty(index, { is_active: !fields[index].is_active });
  };

  const toggleActiveDefault = async (index: number) => {
    if (!eventId) return;
    const field = fields[index];

    try {
      const { error } = await supabase
        .from('event_form_fields')
        .upsert({
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
          is_active: !field.is_active,
          conditional_logic: field.conditional_logic?.enabled ? field.conditional_logic : null,
          db_column: field.db_column || null,
        }, { onConflict: 'event_id,field_key,step' });
      if (error) {
        console.error('toggleActiveDefault error:', error);
        return;
      }

      const data = await fetchFormFields(eventId, false, undefined, true);
      setFields(data.map(toDraft));
    } catch (err) {
      console.error('toggleActiveDefault error:', err);
    }
  };

  const toggleRequiredDefault = async (index: number) => {
    if (!eventId) return;
    const field = fields[index];

    try {
      const { error } = await supabase
        .from('event_form_fields')
        .upsert({
          event_id: eventId,
          field_key: field.field_key,
          field_type: field.field_type,
          label: field.label,
          placeholder: field.placeholder,
          required: !field.required,
          options: field.options.length > 0 ? field.options : null,
          sort_order: field.sort_order,
          step: field.step,
          is_default: false,
          is_active: field.is_active,
          conditional_logic: field.conditional_logic?.enabled ? field.conditional_logic : null,
          db_column: field.db_column || null,
        }, { onConflict: 'event_id,field_key,step' });
      if (error) {
        console.error('toggleRequiredDefault error:', error);
        return;
      }

      const data = await fetchFormFields(eventId, false, undefined, true);
      setFields(data.map(toDraft));
    } catch (err) {
      console.error('toggleRequiredDefault error:', err);
    }
  };

  const toggleRequired = (index: number) => {
    markDirty(index, { required: !fields[index].required });
  };

  const deleteField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const openNewField = async (step: FormStep) => {
    const stepFields = fields.filter((f) => f.step === step);
    const maxOrder = stepFields.reduce((max, f) => Math.max(max, f.sort_order), 0);
    const draft = EMPTY_FIELD(step, maxOrder + 1);
    setEditStep(step);
    setEditingField(draft);
    lastAutoPlaceholder.current = '';

    const defaults = await fetchDefaultFieldsByStep(step, eventId!);
    const localKeys = new Set(fields.filter((f) => f.step === step).map((f) => f.field_key));
    const available = defaults.filter((f) => !localKeys.has(f.field_key));
    setDefaultFields(available);
    setSelectedDefaultKeys([]);
    setDefaultSearch('');
    setDialogMode(available.length > 0 ? 'default' : 'custom');

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

    const dynamicDbColumns: Record<string, string> = {};
    for (const f of fields) {
      if (f.db_column) dynamicDbColumns[f.field_key] = f.db_column;
    }

    if (!editingField.db_column) {
      editingField.db_column = dynamicDbColumns[editingField.field_key] || null;
    }

    setFields((prev) => {
      const next = [...prev];
      if (editingField._new) {
        next.push({ ...editingField, _dirty: true });
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

  const addSelectedDefaults = async () => {
    if (!eventId || selectedDefaultKeys.length === 0) return;
    const newFields = await copyDefaultFieldsByKeys(eventId, selectedDefaultKeys);
    if (newFields.length === 0) return;
    const mapped = newFields.map(f => ({ ...toDraft(f), _dirty: true }));
    setFields((prev) => {
      const existingKeys = new Set(prev.map((f) => f.field_key));
      const trulyNew = mapped.filter((f) => !existingKeys.has(f.field_key));
      return [...prev, ...trulyNew];
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
          conditional_logic: field.conditional_logic?.enabled ? field.conditional_logic : null,
          db_column: field.db_column || null,
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

      const reload = await fetchFormFields(eventId, true, undefined, true);
      setFields(reload.map(toDraft));
    } catch (err) {
      console.error('saveStep exception:', err);
    } finally {
      setSavingStep(null);
    }
  };

  const handleStepToggle = async (step: FormStep, value: boolean) => {
    if (!eventId) return;
    const fieldMap: Record<FormStep, string> = {
      personal: 'step_personal',
      christian_life: 'step_christian_life',
      health: 'step_health',
      emergency: 'step_emergency',
      other: 'step_other',
      payment: 'step_payment',
    };
    const setters: Record<FormStep, (v: boolean) => void> = {
      personal: setStepPersonal,
      christian_life: setStepChristianLife,
      health: setStepHealth,
      emergency: setStepEmergency,
      other: setStepOther,
      payment: () => {},
    };
    setSavingStepToggle(step);
    const { error } = await supabase.from('events').update({ [fieldMap[step]]: value }).eq('id', eventId);
    if (error) {
      console.error('Erro ao salvar etapa:', error.message);
      setters[step](!value);
    }
    setSavingStepToggle(null);
  };

  const isStepEnabled = (step: FormStep): boolean => {
    if (step === 'personal') return stepPersonal;
    if (step === 'christian_life') return stepChristianLife;
    if (step === 'health') return stepHealth;
    if (step === 'emergency') return stepEmergency;
    if (step === 'other') return stepOther;
    return true;
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
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEndDefault}>
        <div className="space-y-6">
          <Card className="bg-card backdrop-blur-md border-border shadow-lg">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <p>Altere a visibilidade dos campos para <strong>{event?.title}</strong>. Campos desativados não aparecerão no formulário de inscrição deste evento.</p>
              </div>
              {groupedFields.map((group) => (
                <div key={group.step}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</h3>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      isStepEnabled(group.step)
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    }`}>
                      {isStepEnabled(group.step) ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({group.fields.filter(f => f.is_active).length}/{group.fields.length})
                    </span>
                  </div>
                  <SortableContext items={group.fields.map((f) => f.id || f.field_key)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {group.fields.map((f) => (
                        <FieldCard
                          key={f.id || f.field_key}
                          f={f}
                          mode="default"
                          onToggleActive={() => toggleActiveDefault(fields.indexOf(f))}
                          onToggleRequired={() => toggleRequiredDefault(fields.indexOf(f))}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <DragOverlay>
          {activeId ? (() => {
            const activeField = fields.find((f) => (f.id || f.field_key) === activeId);
            if (!activeField) return null;
            return (
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-card p-3 shadow-lg opacity-90">
                <GripVertical className="size-4 text-primary" />
                <span className="text-sm font-medium">{activeField.label || '(sem label)'}</span>
              </div>
            );
          })() : null}
        </DragOverlay>
        </DndContext>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-8">
          {isCustom && fields.length === 0 && (
            <Card className="bg-card backdrop-blur-md border-border shadow-lg">
              <CardContent className="pt-6 text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Nenhum campo encontrado. Copie os campos padrão para começar.
                </p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!eventId) return;
                    await copyDefaultFields(eventId);
                    const data = await fetchFormFields(eventId, true, undefined, true);
                    setFields(data.map(toDraft));
                  }}
                >
                  Copiar Campos Padrão
                </Button>
              </CardContent>
            </Card>
          )}
          {groupedFields.map((group, gi) => {
            const enabled = isStepEnabled(group.step);
            const activeCount = group.fields.filter(f => f.is_active).length;
            return (
            <Card key={group.step} className={`bg-card backdrop-blur-md border-border shadow-lg transition-opacity ${!enabled ? 'opacity-50' : ''}`}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</h3>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`step-${group.step}`}
                        checked={enabled}
                        disabled={savingStepToggle === group.step}
                        onCheckedChange={(checked) => {
                          const value = !!checked;
                          const setters: Record<FormStep, (v: boolean) => void> = {
                            personal: setStepPersonal,
                            christian_life: setStepChristianLife,
                            health: setStepHealth,
                            emergency: setStepEmergency,
                            other: setStepOther,
                            payment: () => {},
                          };
                          setters[group.step](value);
                          handleStepToggle(group.step, value);
                        }}
                      />
                      <Label htmlFor={`step-${group.step}`} className="text-xs cursor-pointer text-muted-foreground">
                        {savingStepToggle === group.step ? 'Salvando...' : (enabled ? 'Ativo' : 'Inativo')}
                      </Label>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      ({activeCount}/{group.fields.length})
                    </span>
                  </div>
                   <Button variant="outline" onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : () => openNewField(group.step)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Novo campo
                  </Button>
                </div>
                {group.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum campo neste passo.</p>
                ) : (
                  <SortableContext items={group.fields.map((f) => f.id || f.field_key)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {group.fields.map((f) => (
                        <FieldCard
                          key={f.id || f.field_key}
                          f={f}
                          onToggleActive={() => toggleActive(fields.indexOf(f))}
                          onToggleRequired={() => toggleRequired(fields.indexOf(f))}
                          onEdit={() => openEditField(f)}
                          onDelete={() => deleteField(fields.indexOf(f))}
                        />
                      ))}
                    </div>
                  </SortableContext>
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
            );
          })}
        </div>
        <DragOverlay>
          {activeId ? (() => {
            const activeField = fields.find((f) => (f.id || f.field_key) === activeId);
            if (!activeField) return null;
            return (
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-card p-3 shadow-lg opacity-90">
                <GripVertical className="size-4 text-primary" />
                <span className="text-sm font-medium">{activeField.label || '(sem label)'}</span>
              </div>
            );
          })() : null}
        </DragOverlay>
        </DndContext>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) { setDefaultSearch(''); setSelectedDefaultKeys([]); }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'default' ? 'Adicionar campos padrão' : (editingField?._new ? 'Criar campo personalizado' : 'Editar campo')}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted w-fit mx-auto mb-2">
            <button
              type="button"
              onClick={() => setDialogMode('default')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dialogMode === 'default'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Padrão
            </button>
            <button
              type="button"
              onClick={() => setDialogMode('custom')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                dialogMode === 'custom'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Personalizado
            </button>
          </div>

          {dialogMode === 'default' ? (
            <>
              <div className="py-2 overflow-y-auto min-h-0 flex-1 space-y-2">
                {defaultFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum campo padrão disponível para este passo.
                  </p>
                ) : (
                  <>
                    <Input
                      placeholder="Filtrar campos..."
                      value={defaultSearch}
                      onChange={(e) => setDefaultSearch(e.target.value)}
                      className="mb-3"
                    />
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {defaultFields
                        .filter((f) =>
                          f.label.toLowerCase().includes(defaultSearch.toLowerCase())
                        )
                        .map((f) => (
                          <label
                            key={f.field_key}
                            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              selectedDefaultKeys.includes(f.field_key)
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/30'
                            }`}
                          >
                            <Checkbox
                              checked={selectedDefaultKeys.includes(f.field_key)}
                              onCheckedChange={(v) => {
                                setSelectedDefaultKeys((prev) =>
                                  v
                                    ? [...prev, f.field_key]
                                    : prev.filter((k) => k !== f.field_key)
                                );
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{f.label}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FIELD_TYPE_COLORS[f.field_type] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                              {FIELD_TYPES.find((t) => t.value === f.field_type)?.label || f.field_type}
                            </span>
                          </label>
                        ))}
                    </div>
                  </>
                )}
              </div>
              <DialogFooter className="border-t border-border pt-4">
                <DialogClose render={<Button variant="outline">Cancelar</Button>} />
                <Button onClick={addSelectedDefaults} disabled={selectedDefaultKeys.length === 0}>
                  Adicionar ({selectedDefaultKeys.length})
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {editingField && (
                <div className="space-y-4 py-2 overflow-y-auto min-h-0 flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label>Tipo *</Label>
                      <Select
                        value={editingField.field_type}
                        onValueChange={(v: FieldType) =>
                          setEditingField({ ...editingField, field_type: v, options: v === 'gender' ? ['Masculino', 'Feminino'] : (v === 'select' || v === 'checkbox') ? editingField.options : [] })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>{FIELD_TYPES.find((t) => t.value === editingField.field_type)?.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(editingField._new
                            ? FIELD_TYPES.filter((t) => ['text', 'select', 'checkbox', 'textarea'].includes(t.value))
                            : FIELD_TYPES
                          ).map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <div className="flex items-center gap-2 mt-2">
                        <Checkbox
                          id="field-required"
                          checked={editingField.required}
                          onCheckedChange={(v) => setEditingField({ ...editingField, required: !!v })}
                        />
                        <Label htmlFor="field-required">Obrigatório</Label>
                      </div>
                    </div>
                    <div>
                      <Label>Placeholder</Label>
                      <Input
                        value={editingField.placeholder}
                        onChange={(e) => setEditingField({ ...editingField, placeholder: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Checkbox
                          id="field-active"
                          checked={editingField.is_active}
                          onCheckedChange={(v) => setEditingField({ ...editingField, is_active: !!v })}
                        />
                        <Label htmlFor="field-active">Ativo</Label>
                      </div>
                    </div>
                  </div>
                  {(editingField.field_type === 'select' || editingField.field_type === 'checkbox' || editingField.field_type === 'gender') && (
                    <div>
                      <Label>Opções (uma por linha)</Label>
                      <Textarea
                        value={editingField.options.join('\n')}
                        onChange={(e) =>
                          setEditingField({
                            ...editingField,
                            options: e.target.value.split('\n'),
                          })
                        }
                        onBlur={() =>
                          setEditingField((prev) => prev ? {
                            ...prev,
                            options: prev.options.map((o) => o.trim()).filter(Boolean),
                          } : prev)
                        }
                        rows={4}
                        placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                      />
                    </div>
                  )}
                  <ConditionalLogicBuilder
                    value={editingField.conditional_logic}
                    selfKey={editingField.field_key}
                    allFields={fields as FormField[]}
                    onChange={(cl) => setEditingField({ ...editingField, conditional_logic: cl })}
                  />
                </div>
              )}
              <DialogFooter className="border-t border-border pt-4">
                <DialogClose render={<Button variant="outline">Cancelar</Button>} />
                <Button onClick={saveFieldDraft} disabled={!editingField?.label.trim() || !editingField?.field_key.trim()}>
                  {editingField?._new ? 'Adicionar' : 'Salvar'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
