import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConditionRow } from './ConditionRow';
import { ActionCheckboxes } from './ActionCheckboxes';
import { detectCircularDeps } from '@/lib/conditional-logic';
import { EMPTY_CONDITIONAL_LOGIC } from '@/lib/form-fields';
import type { ConditionalLogic, ConditionGroup, Condition, FormField } from '@/lib/form-fields';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';

interface Props {
  value: ConditionalLogic | null;
  selfKey: string;
  allFields: FormField[];
  onChange: (value: ConditionalLogic | null) => void;
}

function newGroup(): ConditionGroup {
  return {
    id: crypto.randomUUID(),
    operator: 'AND',
    conditions: [{ field_key: '', comparison: 'equals', value: '' }],
    actions: ['show'],
  };
}

export function ConditionalLogicBuilder({ value, selfKey, allFields, onChange }: Props) {
  const cl = value ?? EMPTY_CONDITIONAL_LOGIC;
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateGroup = (groupId: string, patch: Partial<ConditionGroup>) => {
    const groups = cl.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
    const next = { ...cl, groups };
    validate(next);
    onChange(next);
  };

  const addGroup = () => {
    onChange({ ...cl, groups: [...cl.groups, newGroup()] });
  };

  const removeGroup = (groupId: string) => {
    onChange({ ...cl, groups: cl.groups.filter((g) => g.id !== groupId) });
  };

  const addCondition = (groupId: string) => {
    updateGroup(groupId, {
      conditions: [
        ...cl.groups.find((g) => g.id === groupId)!.conditions,
        { field_key: '', comparison: 'equals', value: '' },
      ],
    });
  };

  const updateCondition = (groupId: string, index: number, cond: Condition) => {
    const group = cl.groups.find((g) => g.id === groupId)!;
    const conditions = group.conditions.map((c, i) => (i === index ? cond : c));
    updateGroup(groupId, { conditions });
  };

  const removeCondition = (groupId: string, index: number) => {
    const group = cl.groups.find((g) => g.id === groupId)!;
    if (group.conditions.length <= 1) return;
    updateGroup(groupId, {
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  };

  const validate = (next: ConditionalLogic) => {
    if (!next.enabled) {
      setValidationError(null);
      return;
    }
    const tempFields = allFields.map((f) => ({
      ...f,
      conditional_logic: f.field_key === selfKey ? next : f.conditional_logic,
    }));
    const result = detectCircularDeps(tempFields as FormField[]);
    setValidationError(result.valid ? null : `Ciclo: ${result.cycle?.join(' → ')} → ${result.cycle?.[0]}`);
  };

  const handleToggle = (enabled: boolean) => {
    const next: ConditionalLogic = {
      enabled,
      groups: enabled ? (cl.groups.length > 0 ? cl.groups : [newGroup()]) : cl.groups,
    };
    validate(next);
    onChange(next.enabled ? next : null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Lógica Condicional</Label>
        <Checkbox
          id="cl-toggle"
          checked={cl.enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {cl.enabled && (
        <div className="space-y-4 rounded-lg border border-border p-3 bg-muted/20">
          {validationError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {cl.groups.map((group, gi) => (
            <div key={group.id} className="space-y-3">
              {gi > 0 && (
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-xs font-bold text-primary">OU</span>
                  <Separator className="flex-1" />
                </div>
              )}

              <div className="rounded-lg border border-border p-3 space-y-3 bg-background">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Grupo {gi + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={group.operator}
                      onValueChange={(v: 'AND' | 'OR') => updateGroup(group.id, { operator: v })}
                    >
                      <SelectTrigger className="w-16 h-7 text-xs">
                        <SelectValue>{group.operator === 'AND' ? 'E' : 'OU'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AND">E</SelectItem>
                        <SelectItem value="OR">OU</SelectItem>
                      </SelectContent>
                    </Select>
                    {cl.groups.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeGroup(group.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {group.conditions.map((cond, ci) => (
                    <ConditionRow
                      key={ci}
                      condition={cond}
                      availableFields={allFields}
                      selfKey={selfKey}
                      onChange={(c) => updateCondition(group.id, ci, c)}
                      onRemove={() => removeCondition(group.id, ci)}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addCondition(group.id)}
                  >
                    <Plus className="size-3 mr-1" /> Adicionar condição
                  </Button>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Então:</p>
                  <ActionCheckboxes
                    selected={group.actions}
                    autoFillValue={group.auto_fill_value}
                    onChange={(actions, afv) =>
                      updateGroup(group.id, { actions, auto_fill_value: afv })
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={addGroup}
          >
            <Plus className="size-3 mr-1" /> Adicionar grupo
          </Button>
        </div>
      )}
    </div>
  );
}
