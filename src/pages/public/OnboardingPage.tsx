import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ChevronRight, Church, User, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, churchId } = useAuth();
  const [churchName, setChurchName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Se já tem igreja, redirecionar para o painel
  useEffect(() => {
    if (!authLoading && churchId) {
      navigate('/app/eventos', { replace: true });
    }
  }, [authLoading, churchId, navigate]);

  // Se não está autenticado, redirecionar para login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = churchName.trim();
    if (!trimmed) {
      setError('Nome da igreja é obrigatório.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: rpcError } = await supabase.rpc('complete_oauth_onboarding', {
        p_church_name: trimmed,
      });

      if (rpcError) {
        setError(rpcError.message || 'Erro ao criar igreja. Tente novamente.');
        setIsLoading(false);
        return;
      }

      // Forçar refresh da sessão para obter JWT com os novos claims
      const { error: refreshError } = await supabase.auth.getUser();
      if (refreshError) {
        // Mesmo com erro de refresh, o onboarding foi criado
        // O AuthProvider vai detectar na próxima verificação
      }

      // Navegar para o painel
      navigate('/app/eventos', { replace: true });
    } catch {
      setError('Erro inesperado. Tente novamente.');
      setIsLoading(false);
    }
  };

  // Enquanto carrega, mostrar spinner
  if (authLoading || churchId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <Loader2 className="size-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 15s ease infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-gradient { animation: none; }
        }
      `}</style>

      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 relative overflow-hidden antialiased text-slate-100 animate-gradient">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-16 size-96 bg-[radial-gradient(circle,rgba(217,119,6,0.1)_0%,transparent_70%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-16 size-72 bg-[radial-gradient(circle,rgba(99,102,241,0.05)_0%,transparent_70%)]" />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Link to="/" className="font-serif text-2xl font-bold text-white mb-8 block hover:text-white/80 transition-colors z-10">
            Kairós <span className="text-amber-500">Events</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-sm z-10"
        >
          <Card className="border-white/10 bg-card/30 backdrop-blur-xl shadow-xl shadow-black/30">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-amber-500/10">
                <Church className="size-5 text-amber-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-white">Complete seu cadastro</CardTitle>
              <CardDescription className="text-slate-400">
                Informe o nome da sua igreja para começar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Dados do Google (read-only) */}
                {user?.user_metadata?.full_name && (
                  <div className="space-y-2">
                    <Label className="text-slate-200">Nome Completo</Label>
                    <div className="relative">
                      <Input
                        value={user.user_metadata.full_name}
                        readOnly
                        className="bg-slate-900/30 border-slate-700/50 text-slate-400 pl-10 cursor-not-allowed"
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-600" />
                    </div>
                  </div>
                )}

                {user?.email && (
                  <div className="space-y-2">
                    <Label className="text-slate-200">E-mail</Label>
                    <div className="relative">
                      <Input
                        value={user.email}
                        readOnly
                        className="bg-slate-900/30 border-slate-700/50 text-slate-400 pl-10 cursor-not-allowed"
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-600" />
                    </div>
                  </div>
                )}

                {/* Campo obrigatório: nome da igreja */}
                <div className="space-y-2">
                  <Label htmlFor="churchName" className="text-slate-200">
                    Nome da Igreja <span className="text-amber-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="churchName"
                      placeholder="Ex: Igreja Batista Central"
                      value={churchName}
                      onChange={(e) => setChurchName(e.target.value)}
                      className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition-all duration-200 pl-10"
                      autoFocus
                    />
                    <Church className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-900/30 border border-red-500/50 p-3 rounded-lg text-center">
                    <p className="text-sm text-red-300 font-medium">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-amber-600 text-white hover:bg-amber-700 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isLoading || !churchName.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando sua igreja...
                    </>
                  ) : (
                    <>
                      Começar agora <ChevronRight className="ml-1 size-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="absolute bottom-4 text-center z-10"
        >
          <p className="text-xs text-slate-500 flex items-center gap-1.5 justify-center">
            <ShieldCheck className="size-3" />
            &copy; {new Date().getFullYear()} Kairós Events &middot; Conexão segura
          </p>
        </motion.footer>
      </div>
    </>
  );
}
