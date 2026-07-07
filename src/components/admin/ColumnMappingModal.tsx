import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { FormStep } from '@/lib/form-fields';

const COLUMNS_BY_STEP: Record<FormStep, { value: string; label: string }[]> = {
  personal: [
    { value: 'full_name', label: 'Nome completo' },
    { value: 'email', label: 'E-mail' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'birth_date', label: 'Data de nascimento' },
    { value: 'gender', label: 'Gênero' },
    { value: 'cpf', label: 'CPF' },
    { value: 'rg', label: 'RG' },
    { value: 'cep', label: 'CEP' },
    { value: 'address', label: 'Endereço' },
    { value: 'city', label: 'Cidade' },
    { value: 'state', label: 'Estado' },
    { value: 'accept_terms', label: 'Aceite dos termos' },
  ],
  christian_life: [
    { value: 'perfil_fe', label: 'Perfil' },
    { value: 'is_baptized', label: 'É batizado' },
    { value: 'church', label: 'Igreja' },
    { value: 'pastor', label: 'Pastor' },
    { value: 'church_role', label: 'Cargo/função' },
    { value: 'church_role_other', label: 'Outro cargo' },
    { value: 'godparent', label: 'Padrinho/madrinha' },
    { value: 'godparent_contact', label: 'Contato do padrinho' },
    { value: 'pastoral_authorization', label: 'Autorização pastoral' },
  ],
  health: [
    { value: 'health_info', label: 'Informações de saúde' },
    { value: 'has_allergies', label: 'Possui alergias' },
    { value: 'allergy_description', label: 'Descrição das alergias' },
    { value: 'dietary_restrictions', label: 'Restrições alimentares' },
  ],
  emergency: [
    { value: 'emergency_contact', label: 'Contato de emergência' },
    { value: 'emergency_phone', label: 'Telefone de emergência' },
  ],
  other: [],
  payment: [],
};

interface Props {
  open: boolean;
  step: FormStep;
  label: string;
  onConfirm: (dbColumn: string | null) => void;
}

export function ColumnMappingModal({ open, step, label, onConfirm }: Props) {
  const [selected, setSelected] = useState<string>('');
  const columns = COLUMNS_BY_STEP[step] || [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onConfirm(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mapear campo para coluna do banco</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            O campo <strong>"{label}"</strong> não foi reconhecido como uma coluna padrão do sistema.
          </p>
          <p className="text-sm text-muted-foreground">
            Deseja mapeá-lo para uma coluna existente? Se não, o valor será salvo como campo extra.
          </p>
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="db_column"
                value=""
                checked={selected === ''}
                onChange={() => setSelected('')}
              />
              Não mapear (campo extra)
            </label>
            {columns.map((col) => (
              <label key={col.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="db_column"
                  value={col.value}
                  checked={selected === col.value}
                  onChange={() => setSelected(col.value)}
                />
                {col.label}
                <span className="text-xs text-muted-foreground">({col.value})</span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onConfirm(null)}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(selected || null)}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
