import { useTrial } from '@/components/layout/ChurchGuard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sparkles, AlertTriangle, Clock } from 'lucide-react';

export function TrialBanner() {
  const trial = useTrial();

  if (!trial) return null;

  const isUrgent = (trial.daysRemaining !== null && trial.daysRemaining <= 3) || trial.regs >= 14;
  const isWarning = trial.daysRemaining !== null && trial.daysRemaining <= 7;

  return (
    <div className={cn(
      'flex shrink-0 items-center justify-between gap-4 px-4 py-3 md:px-6 lg:px-8 text-sm print:hidden',
      isUrgent
        ? 'bg-red-600/15 text-red-600'
        : 'bg-amber-500/10 text-amber-600'
    )}>
      <div className="flex items-center gap-2">
        {isUrgent
          ? <AlertTriangle className="size-4 shrink-0" />
          : isWarning
            ? <Clock className="size-4 shrink-0" />
            : <Sparkles className="size-4 shrink-0" />
        }
        <span>
          Plano Gratuito:{' '}
          <strong>{trial.regs}</strong> de <strong>{trial.limit}</strong> inscrições
          {trial.daysRemaining !== null && (
            <> · <strong>{trial.daysRemaining}</strong> {trial.daysRemaining === 1 ? 'dia' : 'dias'} restante{trial.daysRemaining !== 1 ? 's' : ''}</>
          )}
        </span>
      </div>
      <Button
        size="sm"
        onClick={() => (trial as any).openUpgrade?.()}
        className={cn(
          'shrink-0 font-semibold shadow-lg',
          isUrgent
            ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'
            : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-600/20'
        )}
      >
        Fazer Upgrade
      </Button>
    </div>
  );
}
