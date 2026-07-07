import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Lock, X } from 'lucide-react';

interface TrialData {
  regs: number;
  limit: number;
  daysRemaining: number | null;
  trialEndsAt: string | null;
  status: string;
  isTrialExceeded: boolean;
}

type TrialContextValue = TrialData & { openUpgrade: () => void };

const TrialContext = createContext<TrialContextValue | null>(null);

export function useTrial() {
  return useContext(TrialContext);
}

export function ChurchGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin, churchId } = useAuth();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [trialData, setTrialData] = useState<TrialData | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    if (!user || !isAdmin || isSuperAdmin) { setChecking(false); return; }

    let cancelled = false;
    const check = async () => {
      if (!churchId || cancelled) {
        if (!cancelled) setChecking(false);
        return;
      }

      const { data: church } = await supabase
        .from('churches')
        .select('is_active, status, trial_ends_at, trial_suspended_at')
        .eq('id', churchId)
        .maybeSingle();

      if (cancelled) return;

      const isBlocked = church ? !church.is_active || church.status === 'suspended' : false;
      setBlocked(isBlocked);

      if (church?.status === 'trial' && !isBlocked) {
        const { count } = await supabase
          .from('registrations')
          .select('*', { count: 'exact', head: true })
          .eq('church_id', churchId)
          .is('deleted_at', null);

        const daysRemaining = church.trial_ends_at
          ? Math.max(0, Math.ceil((new Date(church.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null;

        setTrialData({
          regs: count ?? 0,
          limit: 15,
          daysRemaining,
          trialEndsAt: church.trial_ends_at,
          status: church.status,
          isTrialExceeded: (count ?? 0) >= 15 || (daysRemaining !== null && daysRemaining <= 0),
        });
      } else {
        setTrialData(null);
      }

      setChecking(false);
    };
    check();
    return () => { cancelled = true; };
  }, [user?.id, isAdmin, churchId]);

  const handleOpenUpgrade = () => setUpgradeModalOpen(true);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 px-4 text-center text-white">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-slate-950 p-8 shadow-2xl">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-500/10">
            <Lock className="size-8 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-white">
              Assinatura Suspensa
            </h1>
            <p className="text-sm leading-relaxed text-slate-400">
              O período de vigência do plano desta igreja expirou ou identificamos uma pendência. Faça upgrade para reativar o painel e continuar gerenciando seus eventos.
            </p>
          </div>
          <div className="pt-2 space-y-3">
            <Button
              onClick={() => window.open('/#planos', '_blank')}
              className="w-full bg-amber-500 font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-600"
            >
              Fazer Upgrade
            </Button>
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=kairosevents.suporte@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-sm text-slate-400 hover:text-white transition-colors"
            >
              Falar com suporte
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TrialContext.Provider value={trialData ? { ...trialData, openUpgrade: handleOpenUpgrade } : null}>
      {children}

      {upgradeModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-4xl rounded-2xl bg-slate-50 p-8 shadow-2xl">
            <button
              onClick={() => setUpgradeModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="size-5" />
            </button>

            <div className="text-center">
              <h2 className="text-3xl font-serif font-bold text-slate-900">
                Pare de perder dinheiro com taxas
              </h2>
              <p className="text-slate-600 mt-2">
                O Kairós Events tem valor fixo. O PIX cai 100% na conta da igreja.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col">
                <h3 className="text-xl font-bold text-slate-900">Plano Mensal</h3>
                <p className="text-slate-500 text-sm mt-1">Ideal para testar o sistema em um evento específico.</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-slate-900">R$ 59,90</span>
                  <span className="text-sm text-slate-500 ml-1">/mês</span>
                </div>
                <ul className="mt-6 space-y-3 flex-1">
                  {['Eventos ilimitados', 'Check-in digital', 'Recibos via WhatsApp', 'Suporte por e-mail'].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <svg className="size-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    )
                  )}
                </ul>
                <button
                  onClick={() => {
                    setUpgradeModalOpen(false);
                    navigate('/register');
                  }}
                  className="border border-amber-500 text-amber-600 hover:bg-amber-50 w-full py-3 rounded-lg font-semibold mt-6 transition-colors"
                >
                  Criar nova conta grátis
                </button>
              </div>

              <div className="relative bg-slate-900 border border-amber-500/50 rounded-xl p-8 shadow-xl shadow-amber-500/10 flex flex-col">
                <span className="absolute -top-3 right-4 bg-amber-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-full">
                  MAIS VANTAJOSO
                </span>
                <h3 className="text-xl font-bold text-white">Acesso Anual</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Tenha o Kairós rodando em todos os retiros e conferências do ano.
                </p>
                <div className="mt-4">
                  <span className="text-sm text-slate-500 line-through block">De R$ 718,80</span>
                  <span className="text-4xl font-bold text-amber-500">R$ 482,50</span>
                  <span className="text-slate-400 text-sm ml-1">/ano</span>
                </div>
                <ul className="mt-6 space-y-3 flex-1">
                  {[
                    'Tudo do plano mensal',
                    'Prioridade em atualizações',
                    'Configuração inicial',
                    'Suporte prioritário WhatsApp',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                      <svg className="size-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    setUpgradeModalOpen(false);
                    navigate('/register');
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 w-full py-3 rounded-lg font-bold mt-6 shadow-lg shadow-amber-500/20 transition-colors"
                >
                  Criar nova conta grátis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TrialContext.Provider>
  );
}
