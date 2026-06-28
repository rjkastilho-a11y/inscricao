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
import { Loader2, ChevronRight, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut, churchId } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [churchBlocked, setChurchBlocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { isBlocked, remaining, recordAttempt, reset } = useRateLimit({
    key: 'login',
    maxAttempts: 5,
    cooldownMs: 30000,
  });

  useEffect(() => {
    if (user && !authLoading && churchId) {
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
  }, [user, authLoading, churchId, navigate]);

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
    // Fundo profissional alinhado com a Landing Page (gradient dark slate)
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 relative overflow-hidden antialiased text-slate-100">
      
      {/* Elementos decorativos de fundo (opcional, para dar mais 'vida') */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-16 size-96 bg-[radial-gradient(circle,rgba(217,119,6,0.1)_0%,transparent_70%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-16 size-72 bg-[radial-gradient(circle,rgba(99,102,241,0.05)_0%,transparent_70%)]" />

      {/* Branding acima do Card */}
      <Link to="/" className="font-serif text-2xl font-bold text-white mb-8 block hover:text-white/80 transition-colors z-10">
        Kairós <span className="text-amber-500">Events</span>
      </Link>

      {/* Card Refinado (Glassmorphism leve) */}
      <Card className="w-full max-w-sm z-10 border-white/5 bg-card/50 backdrop-blur-sm shadow-2xl shadow-black/30">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-white">Acessar Painel</CardTitle>
          <CardDescription className="text-slate-400">
            Digite suas credenciais administrativas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            {/* Campo E-mail */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu.email@igreja.com"
                {...form.register('email')} 
                className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-400 mt-1 font-medium">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Campo Senha */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-200">Senha</Label>
                {/* Melhoria de UX: Link de recuperar senha (precisa criar a rota) */}
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
                  className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-red-400 mt-1 font-medium">{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Mensagem de erro da autenticação Supabase */}
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 p-3 rounded-md text-center">
                <p className="text-sm text-red-300 font-medium">{error}</p>
              </div>
            )}

            {/* Botão com estados de carregamento */}
            <Button 
              type="submit" 
              className="w-full bg-amber-600 text-white hover:bg-amber-700 transition-colors font-semibold" 
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

          {/* Link de cadastro PLG */}
          <p className="mt-6 text-center text-sm text-slate-400">
            Ainda não tem conta?{' '}
            <Link to="/register" className="text-amber-500 hover:text-amber-400 font-medium transition-colors">
              Comece seu teste grátis
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Footer simples da página de login */}
      <footer className="absolute bottom-4 text-center z-10">
        <p className="text-xs text-slate-600">
          &copy; {new Date().getFullYear()} Kairós Events &middot; Área Restrita
        </p>
      </footer>
    </div>
  );
}