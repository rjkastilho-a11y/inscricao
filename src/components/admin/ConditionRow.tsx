import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { COMPARISON_OPTIONS } from '@/lib/form-fields';
import type { Condition, ComparisonOp, FormField } from '@/lib/form-fields';

interface Props {
  condition: Condition;
  availableFields: FormField[];
  selfKey: string;
  onChange: (updated: Condition) => void;
  onRemove: () => void;
}

export function ConditionRow({ condition, availableFields, selfKey, onChange, onRemove }: Props) {
  const needsValue = !['is_empty', 'not_empty'].includes(condition.comparison);
  const sourceField = availableFields.find((f) => f.field_key === condition.field_key);

  const renderValueInput = () => {
    if (!needsValue) return null;

    // Checkbox sem opções → dropdown Sim/Não
    if (sourceField?.field_type === 'checkbox' && (!sourceField.options || sourceField.options.length === 0)) {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
            <SelectValue placeholder="Valor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Select → dropdown com as opções do campo
    if (sourceField?.field_type === 'select' && sourceField.options && sourceField.options.length > 0) {
      return (
        <Select
          value={condition.value}
          onValueChange={(v) => onChange({ ...condition, value: v })}
        >
          <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
            <SelectValue placeholder="Valor" />
          </SelectTrigger>
          <SelectContent>
            {sourceField.options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Número → input numérico
    if (sourceField?.field_type === 'number') {
      return (
        <Input
          type="number"
          step="any"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Valor"
          className="w-full sm:w-36 h-8 text-xs"
        />
      );
    }

    // Padrão: input de texto
    return (
      <Input
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder="Valor"
        className="w-full sm:w-36 h-8 text-xs"
      />
    );
  };

  return (
    <div className="flex flex-wrap items-start gap-2">
      <span className="text-xs text-muted-foreground pt-2 shrink-0">Quando</span>

      <Select
        value={condition.field_key}
        onValueChange={(v) => onChange({ ...condition, field_key: v })}
      >
        <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
          <SelectValue placeholder="Campo" />
        </SelectTrigger>
        <SelectContent>
          {availableFields
            .filter((f) => f.field_key !== selfKey)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((f) => (
              <SelectItem key={f.field_key} value={f.field_key}>
                {f.label || f.field_key}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.comparison}
        onValueChange={(v) => {
          const newComp = v as ComparisonOp;
          const shouldClear = ['is_empty', 'not_empty'].includes(newComp);
          onChange({ ...condition, comparison: newComp, value: shouldClear ? '' : condition.value });
        }}
      >
        <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
          <SelectValue>{COMPARISON_OPTIONS.find((op) => op.value === condition.comparison)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COMPARISON_OPTIONS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {renderValueInput()}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
