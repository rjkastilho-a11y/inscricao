import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ChevronRight, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut, churchId, needsOnboarding } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [churchBlocked, setChurchBlocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { isBlocked, remaining, recordAttempt, reset } = useRateLimit({
    key: 'login',
    maxAttempts: 5,
    cooldownMs: 30000,
  });

  useEffect(() => {
    if (user && !authLoading) {
      if (needsOnboarding) {
        navigate('/onboarding', { replace: true });
      } else if (churchId) {
        supabase.from('churches')
          .select('is_active, status')
          .eq('id', churchId)
          .maybeSingle()
          .then(({ data }) => {
            if (data && (!data.is_active || data.status === 'suspended')) {
              setChurchBlocked(true);
            } else {
              navigate('/app/eventos', { replace: true });
            }
          });
      }
    }
  }, [user, authLoading, churchId, needsOnboarding, navigate]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmit = async (data: LoginFormData) => {
    if (isBlocked) {
      setError(`Muitas tentativas. Aguarde ${remaining}s.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: authResult, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      recordAttempt();
      setError('E-mail ou senha inválidos.');
      setIsLoading(false);
      return;
    }

    reset();

    if (authResult.session) {
      const uid = authResult.session.user.id;
      const { data: roleData } = await supabase
        .from('user_roles').select('church_id').eq('user_id', uid).maybeSingle();

      if (roleData?.church_id) {
        const { data: church } = await supabase
          .from('churches').select('is_active, status')
          .eq('id', roleData.church_id).maybeSingle();

        if (church && (!church.is_active || church.status === 'suspended')) {
          setChurchBlocked(true);
          setIsLoading(false);
          return;
        }
      }
    }

    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);

    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false,
      },
    });

    if (googleError) {
      setError('Erro ao conectar com Google. Tente novamente.');
      setIsGoogleLoading(false);
    }
  };

  if (churchBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 relative overflow-hidden antialiased text-slate-100">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-16 size-96 bg-[radial-gradient(circle,rgba(217,119,6,0.1)_0%,transparent_70%)]" />
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-slate-950 p-8 shadow-2xl text-center relative z-10">
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
            <button
              onClick={() => { signOut(); setChurchBlocked(false); }}
              className="w-full text-sm text-slate-500 hover:text-white transition-colors"
            >
              Sair e entrar com outra conta
            </button>
          </div>
        </div>
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
        <div aria-hidden="true" className="pointer-events-none absolute top-1/3 -right-10 size-48 bg-[radial-gradient(circle,rgba(217,119,6,0.06)_0%,transparent_70%)]" />

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
                <Lock className="size-5 text-amber-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-white">Acessar Painel</CardTitle>
              <CardDescription className="text-slate-400">
                Digite suas credenciais administrativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {/* Botão Google */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading || isLoading}
                  className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-semibold py-2.5 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <svg className="size-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Entrar com Google
                </button>

                {/* Separador */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-950 px-2 text-slate-500">ou</span>
                  </div>
                </div>

                {/* Formulário email/senha */}
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@igreja.com"
                    {...form.register('email')}
                    className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition-all duration-200"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-400 mt-1 font-medium">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-200">Senha</Label>
                    <Link to="/reset-password" className="text-sm text-slate-400 hover:text-amber-400 transition-colors">
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...form.register('password')}
                      className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition-all duration-200 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-all duration-200"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-400 mt-1 font-medium">{form.formState.errors.password.message}</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-900/30 border border-red-500/50 p-3 rounded-lg text-center">
                    <p className="text-sm text-red-300 font-medium">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-amber-600 text-white hover:bg-amber-700 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isLoading || isBlocked}
                >
                  {isBlocked ? (
                    `Aguarde ${remaining}s`
                  ) : isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    <>
                      Entrar no sistema <ChevronRight className="ml-1 size-4" />
                    </>
                  )}
                </Button>
              </form>
              </div>

              <p className="mt-6 text-center text-xs text-slate-600">
                Sem conta Google?{' '}
                <Link to="/register" className="text-slate-500 hover:text-slate-400 transition-colors">
                  Criar com email
                </Link>
              </p>
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
