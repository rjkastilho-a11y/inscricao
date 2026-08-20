import { useState, type ReactNode } from 'react';
import { useFeatureGate, type FeatureName } from '@/hooks/useFeatureGate';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { Button } from '@/components/ui/button';
import { Crown, Lock, Sparkles } from 'lucide-react';

interface PremiumGateProps {
  feature: FeatureName;
  featureName?: string;
  children: ReactNode;
  mode?: 'blur' | 'lock';
}

export function PremiumGate({ feature, featureName, children, mode = 'blur' }: PremiumGateProps) {
  const { hasAccess, isLoading } = useFeatureGate(feature);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (isLoading) return <>{children}</>;
  if (hasAccess) return <>{children}</>;

  if (mode === 'blur') {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40 blur-[2px]">
          {children}
        </div>

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl border border-border bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10">
              <Crown className="size-6 text-amber-500" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {featureName ?? 'Funcionalidade Premium'}
            </p>
            <p className="text-xs text-muted-foreground">
              Disponível no Plano Anual
            </p>
            <Button size="sm" onClick={() => setUpgradeOpen(true)} className="gap-2">
              <Sparkles className="size-4" />
              Desbloquear
            </Button>
          </div>
        </div>

        <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} featureName={featureName} />
      </div>
    );
  }

  return (
    <div className="relative inline-flex">
      <div className="pointer-events-none opacity-50">{children}</div>
      <button
        type="button"
        onClick={() => setUpgradeOpen(true)}
        className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border"
      >
        <Lock className="size-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-600">Premium</span>
      </button>
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} featureName={featureName} />
    </div>
  );
}
