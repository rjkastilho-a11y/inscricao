import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { copyToClipboard } from '@/lib/clipboard';
import { useEvent } from '@/contexts/useEvent';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, RefreshCw, Trash2 } from 'lucide-react';
import { useTrial } from '@/components/layout/ChurchGuard';

export default function CheckinLinkPage() {
  const { event } = useEvent();
  const { eventId } = useParams<{ eventId: string }>();
  const trial = useTrial();

  const [checkinToken, setCheckinToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const fetchToken = async () => {
      const { data } = await supabase
        .from('events')
        .select('checkin_token')
        .eq('id', eventId)
        .single();
      setCheckinToken(data?.checkin_token ?? null);
      setLoading(false);
    };
    fetchToken();
  }, [eventId]);

  const generateToken = async () => {
    if (!eventId) return;
    setSaving(true);
    const token = crypto.randomUUID();
    const { error } = await supabase
      .from('events')
      .update({ checkin_token: token })
      .eq('id', eventId);
    if (!error) setCheckinToken(token);
    setSaving(false);
  };

  const removeToken = async () => {
    if (!eventId) return;
    setSaving(true);
    const { error } = await supabase
      .from('events')
      .update({ checkin_token: null })
      .eq('id', eventId);
    if (!error) setCheckinToken(null);
    setSaving(false);
  };

  const checkinUrl = checkinToken
    ? `${window.location.origin}/e/${event?.slug ?? ''}/checkin?token=${checkinToken}`
    : null;

  return (
    <div>
      <PageHeader title="Check-in" badge={event?.title} />

      <Card className="bg-card backdrop-blur-md border-border shadow-lg max-w-xl">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Link de check-in público</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Crie um link para compartilhar com a equipe de portaria. Quem tiver o link pode fazer
            check-in dos inscritos sem precisar acessar o painel administrativo.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : checkinToken && checkinUrl ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 text-foreground truncate max-md:h-11 max-md:flex max-md:items-center">
                  {checkinUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 bg-card backdrop-blur-md border-border max-md:h-11 max-md:w-11 rounded-lg"
                  onClick={async () => {
                    await copyToClipboard(checkinUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card backdrop-blur-md border-border max-md:h-11 rounded-lg"
                  onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : generateToken}
                  disabled={saving}
                >
                  <RefreshCw className={`size-4 mr-1 sm:mr-2 ${saving ? 'animate-spin' : ''}`} />
                  <span>Gerar</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card backdrop-blur-md border-border text-destructive hover:text-destructive max-md:h-11 rounded-lg"
                  onClick={removeToken}
                  disabled={saving}
                >
                  <Trash2 className="size-4 mr-1 sm:mr-2" />
                  <span>Remover link</span>
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="max-md:h-11 rounded-lg"
              onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : generateToken}
              disabled={saving}
            >
              {saving ? (
                <RefreshCw className="size-4 mr-2 animate-spin" />
              ) : (
                <Copy className="size-4 mr-2" />
              )}
              Gerar link de check-in
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
