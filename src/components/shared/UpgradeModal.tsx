import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Check, Sparkles } from 'lucide-react';

const BENEFITS = ['Formulários Customizados', 'Relatórios Avançados', 'Importação em Lote', 'Etiquetas e Crachás', 'Eventos Ilimitados'];

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export function UpgradeModal({ isOpen, onClose, featureName }: UpgradeModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Crown className="size-6 text-primary" />
          </div>
          <DialogTitle className="text-center font-serif text-xl leading-snug">
            {featureName ? `Desbloqueie ${featureName}` : 'Escale a sua Igreja com o Plano Anual'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {featureName
              ? `A funcionalidade "${featureName}" está disponível no Plano Anual.`
              : 'Esta funcionalidade está disponível no Plano Anual.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="size-3.5 text-emerald-500" />
              </span>
              <span className="text-sm font-medium">{benefit}</span>
            </div>
          ))}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            className="w-full gap-2"
            onClick={() => {
              onClose();
              navigate('/app/configuracoes/plano');
            }}
          >
            <Sparkles className="size-4" />
            Fazer Upgrade Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
