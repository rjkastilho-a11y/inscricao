import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 500;

    const tryGetSession = async () => {
      if (cancelled || attempts >= maxAttempts) {
        if (!cancelled) {
          setError('Tempo esgotado. Tente novamente.');
          setTimeout(() => navigate('/login', { replace: true }), 3000);
        }
        return;
      }

      attempts++;
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (cancelled) return;

      if (sessionError || !session) {
        setTimeout(tryGetSession, intervalMs);
        return;
      }

      try {
        const userId = session.user.id;

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('church_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (cancelled) return;

        if (!roleData?.church_id) {
          navigate('/onboarding', { replace: true });
          return;
        }

        const { data: church } = await supabase
          .from('churches')
          .select('is_active, status')
          .eq('id', roleData.church_id)
          .maybeSingle();

        if (cancelled) return;

        if (church && (!church.is_active || church.status === 'suspended')) {
          setError('Sua assinatura está suspensa. Faça upgrade para acessar.');
          setTimeout(() => navigate('/login', { replace: true }), 3000);
          return;
        }

        navigate('/app/eventos', { replace: true });
      } catch {
        if (!cancelled) {
          setError('Erro inesperado. Tente novamente.');
          setTimeout(() => navigate('/login', { replace: true }), 3000);
        }
      }
    };

    tryGetSession();

    return () => { cancelled = true; };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-500/10">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-sm text-red-300 font-medium">{error}</p>
          <p className="text-xs text-slate-500">Redirecionando para o login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-amber-500" />
        <p className="text-sm text-slate-400">Autenticando...</p>
      </div>
    </div>
  );
}
