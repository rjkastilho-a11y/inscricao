import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ACTION_OPTIONS } from '@/lib/form-fields';
import type { ActionType } from '@/lib/form-fields';

interface Props {
  selected: ActionType[];
  autoFillValue?: string;
  onChange: (actions: ActionType[], autoFillValue?: string) => void;
}

export function ActionCheckboxes({ selected, autoFillValue, onChange }: Props) {
  const toggle = (action: ActionType) => {
    const next = selected.includes(action)
      ? selected.filter((a) => a !== action)
      : [...selected, action];
    onChange(next, autoFillValue);
  };

  const groups = ACTION_OPTIONS.reduce<Record<string, typeof ACTION_OPTIONS>>((acc, opt) => {
    (acc[opt.group] ??= []).push(opt);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([group, options]) => (
        <div key={group}>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{group}</p>
          <div className="space-y-1.5">
            {options.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`action-${opt.value}`}
                  checked={selected.includes(opt.value)}
                  onCheckedChange={() => toggle(opt.value)}
                />
                <Label htmlFor={`action-${opt.value}`} className="text-sm cursor-pointer">
                  {opt.label}
                </Label>
                {opt.value === 'auto_fill' && selected.includes('auto_fill') && (
                  <Input
                    value={autoFillValue ?? ''}
                    onChange={(e) => onChange(selected, e.target.value)}
                    placeholder="Valor"
                    className="ml-2 h-7 w-48 text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
