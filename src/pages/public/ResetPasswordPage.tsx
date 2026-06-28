import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useRateLimit } from '@/hooks/use-rate-limit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isBlocked, remaining, recordAttempt, reset } = useRateLimit({
    key: 'reset-password',
    maxAttempts: 3,
    cooldownMs: 60000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isBlocked) {
      setError(`Muitas tentativas. Aguarde ${remaining}s.`);
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (resetError) {
      recordAttempt();
      setError('Erro ao enviar e-mail de recuperação.');
      return;
    }

    reset();
    setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-6 space-y-2">
            <p className="text-green-600 font-medium">E-mail enviado!</p>
            <p className="text-sm text-muted-foreground">
              Verifique sua caixa de entrada para redefinir sua senha.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted h-8 px-2.5 text-sm font-medium mt-4"
            >
              Voltar ao login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>Digite seu e-mail para receber instruções</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={isBlocked}>
              {isBlocked ? `Aguarde ${remaining}s` : 'Enviar'}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              <Link to="/login" className="hover:underline">Voltar ao login</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
