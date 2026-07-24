import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ChevronRight, Mail, Lock, Eye, EyeOff, User, Church, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, needsOnboarding } = useAuth();
  const justRegistered = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { isBlocked, remaining, recordAttempt, reset } = useRateLimit({
    key: 'register',
    maxAttempts: 3,
    cooldownMs: 60000,
  });

  useEffect(() => {
    if (user && !authLoading && !justRegistered.current) {
      if (needsOnboarding) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/app/eventos', { replace: true });
      }
    }
  }, [user, authLoading, navigate, needsOnboarding]);

  const [form, setForm] = useState({
    fullName: '',
    churchName: '',
    email: '',
    password: '',
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isBlocked) {
      setError(`Muitas tentativas. Aguarde ${remaining}s.`);
      return;
    }

    if (!form.fullName || !form.churchName || !form.email || !form.password) {
      setError('Preencha todos os campos.');
      return;
    }

    setIsLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          church_name: form.churchName,
        },
      },
    });

    if (signUpError) {
      recordAttempt();
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    reset();
    justRegistered.current = true;
    setSuccess(true);
    setIsLoading(false);

    setTimeout(() => navigate('/login'), 4000);
  };

  const handleGoogleRegister = async () => {
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
              <CardTitle className="text-2xl font-bold text-white">Criar Conta</CardTitle>
              <CardDescription className="text-slate-400">
                Comece seu teste grátis — 15 inscrições incluídas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {success ? (
                <div className="text-center space-y-4 py-6">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                    <svg className="size-7 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Conta criada com sucesso!</h3>
                  <p className="text-sm text-slate-400">
                    Enviamos um link de confirmação para <strong className="text-slate-200">{form.email}</strong>.
                    Verifique sua caixa de entrada e spam para ativar sua conta.
                  </p>
                  <p className="text-xs text-slate-500">
                    Redirecionando para o login...
                  </p>
                </div>
              ) : (
              <div className="space-y-4">
                {/* Botão Google */}
                <button
                  type="button"
                  onClick={handleGoogleRegister}
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
                  Cadastrar com Google
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
                <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-200">Nome Completo</Label>
                  <div className="relative">
                    <Input
                      id="fullName"
                      placeholder="Seu nome"
                      value={form.fullName}
                      onChange={handleChange('fullName')}
                      className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition-all duration-200 pl-10"
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="churchName" className="text-slate-200">Nome da Igreja</Label>
                  <div className="relative">
                    <Input
                      id="churchName"
                      placeholder="Ex: Igreja Batista Central"
                      value={form.churchName}
                      onChange={handleChange('churchName')}
                      className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition-all duration-200 pl-10"
                    />
                    <Church className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">E-mail</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@igreja.com"
                      value={form.email}
                      onChange={handleChange('email')}
                      className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition-all duration-200 pl-10"
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={form.password}
                      onChange={handleChange('password')}
                      className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition-all duration-200 pl-10 pr-10"
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-all duration-200"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
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
                  disabled={isLoading || isBlocked}
                >
                  {isBlocked ? (
                    `Aguarde ${remaining}s`
                  ) : isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      Criar conta grátis <ChevronRight className="ml-1 size-4" />
                    </>
                  )}
                </Button>
              </form>
              </div>
              )}
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
