import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Search, UserCheck, Loader2, UserX } from 'lucide-react';

interface CheckinReg {
  id: string;
  full_name: string;
  checked_in: boolean;
}

export default function CheckinPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [eventTitle, setEventTitle] = useState<string>('');
  const [registrations, setRegistrations] = useState<CheckinReg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !token) {
      setError('Link inválido. Verifique o endereço e tente novamente.');
      setLoading(false);
      return;
    }

    const fetchRegistrations = async () => {
      const { data: event } = await supabase
        .from('events')
        .select('title')
        .eq('slug', slug)
        .single();
      setEventTitle(event?.title ?? slug);

      const { data, error: rpcError } = await supabase
        .rpc('get_checkin_list', {
          p_event_slug: slug,
          p_token: token,
        });

      if (rpcError) {
        setError(rpcError.message === 'Link de check-in inválido ou expirado.'
          ? 'Link de check-in inválido ou expirado. Solicite um novo link ao administrador do evento.'
          : 'Erro ao carregar lista. Verifique o link e tente novamente.');
        setLoading(false);
        return;
      }

      setRegistrations(data || []);
      setLoading(false);
    };

    fetchRegistrations();
  }, [slug, token]);

  const handleToggleCheckIn = async (regId: string, currentStatus: boolean) => {
    setCheckingId(regId);
    const { data: newStatus, error: rpcError } = await supabase
      .rpc('toggle_checkin', {
        p_registration_id: regId,
        p_token: token,
      });

    if (!rpcError && newStatus !== null) {
      setRegistrations((prev) =>
        prev.map((r) => (r.id === regId ? { ...r, checked_in: !!newStatus } : r))
      );
    }
    setCheckingId(null);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return registrations;
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return registrations.filter((r) =>
      r.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    );
  }, [search, registrations]);

  const checkedCount = registrations.filter((r) => r.checked_in).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card backdrop-blur-md border-border shadow-lg">
          <CardContent className="p-6 text-center space-y-4">
            <UserX className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-foreground font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-semibold text-foreground">{eventTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {checkedCount} de {registrations.length} confirmados
          </p>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${registrations.length ? (checkedCount / registrations.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {search ? 'Nenhum inscrito encontrado.' : 'Nenhum inscrito neste evento.'}
            </p>
          )}
          {filtered.map((reg) => (
            <Card
              key={reg.id}
              className={`bg-card backdrop-blur-md border-border shadow-sm transition-all ${
                reg.checked_in ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : ''
              }`}
            >
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{reg.full_name}</p>
                  <Badge
                    variant={reg.checked_in ? 'default' : 'outline'}
                    className={reg.checked_in
                      ? 'bg-emerald-600 text-white border-emerald-600 mt-1'
                      : 'mt-1 text-muted-foreground'
                    }
                  >
                    {reg.checked_in ? 'Confirmado' : 'Ausente'}
                  </Badge>
                </div>
                <Button
                  variant={reg.checked_in ? 'outline' : 'default'}
                  size="sm"
                  className={
                    reg.checked_in
                      ? 'h-9 px-3 gap-1.5 shrink-0 border-muted-foreground/30'
                      : 'h-9 px-3 gap-1.5 shrink-0'
                  }
                  onClick={() => handleToggleCheckIn(reg.id, reg.checked_in)}
                  disabled={checkingId === reg.id}
                >
                  {checkingId === reg.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : reg.checked_in ? (
                    <UserX className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  {checkingId === reg.id
                    ? '...'
                    : reg.checked_in
                      ? 'Desmarcar'
                      : 'Check-in'
                  }
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
