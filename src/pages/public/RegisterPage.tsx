import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ChevronRight, Mail, Lock, Eye, EyeOff, User, Church } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { isBlocked, remaining, recordAttempt, reset } = useRateLimit({
    key: 'register',
    maxAttempts: 3,
    cooldownMs: 60000,
  });

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/app/eventos', { replace: true });
    }
  }, [user, authLoading, navigate]);

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
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 relative overflow-hidden antialiased text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-16 size-96 bg-[radial-gradient(circle,rgba(217,119,6,0.1)_0%,transparent_70%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-16 size-72 bg-[radial-gradient(circle,rgba(99,102,241,0.05)_0%,transparent_70%)]" />

      <Link to="/" className="font-serif text-2xl font-bold text-white mb-8 block hover:text-white/80 transition-colors z-10">
        Kairós <span className="text-amber-500">Events</span>
      </Link>

      <Card className="w-full max-w-sm z-10 border-white/5 bg-card/50 backdrop-blur-sm shadow-2xl shadow-black/30">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-white">Criar Conta</CardTitle>
          <CardDescription className="text-slate-400">
            Comece seu teste grátis — 15 inscrições incluídas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-slate-200">Nome Completo</Label>
              <div className="relative">
                <Input
                  id="fullName"
                  placeholder="Seu nome"
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 pl-10"
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-600" />
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
                  className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 pl-10"
                />
                <Church className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-600" />
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
                  className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 pl-10"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-600" />
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
                  className="bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500 pl-10 pr-10"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-600" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/50 p-3 rounded-md text-center">
                <p className="text-sm text-red-300 font-medium">{error}</p>
              </div>
            )}

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
                  Criando conta...
                </>
              ) : (
                <>
                  Criar conta grátis <ChevronRight className="ml-1 size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <footer className="absolute bottom-4 text-center z-10">
        <p className="text-xs text-slate-600">
          &copy; {new Date().getFullYear()} Kairós Events
        </p>
      </footer>
    </div>
  );
}
