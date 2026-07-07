import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SkeletonMobileCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Download, Loader2, Trash2, MessageCircle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { useTrial } from '@/components/layout/ChurchGuard';

interface Invite {
  id: string;
  event_id: string;
  token: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
}

interface GestaoConvitesProps {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventIsOpen?: boolean;
}

export default function GestaoConvites({ eventId, eventSlug, eventTitle, eventIsOpen }: GestaoConvitesProps) {
  console.log('[GestaoConvites] Renderizando com eventId:', eventId, 'eventSlug:', eventSlug);
  const trial = useTrial();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [publicOpen, setPublicOpen] = useState(eventIsOpen ?? true);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const MOBILE_LIMIT = 3;

  useEffect(() => {
    setPublicOpen(eventIsOpen ?? true);
  }, [eventIsOpen]);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    setInviteError(null);
    const { data, error } = await supabase
      .from('event_invites')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GestaoConvites] Erro ao buscar convites:', error.message);
      setInviteError(error.message);
    } else {
      setInvites(data as Invite[]);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleGenerate = async (count: number) => {
    setGenerating(true);
    const tokens = Array.from({ length: count }, () => ({
      event_id: eventId,
      token: crypto.randomUUID(),
    }));

    const { error } = await supabase.from('event_invites').insert(tokens);

    if (error) {
      toast.error('Erro ao gerar convites: ' + error.message);
    } else {
      await fetchInvites();
    }
    setGenerating(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('event_invites').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      setInvites((prev) => prev.filter((i) => i.id !== id));
    }
    setDeletingId(null);
  };

  const handleExportCsv = () => {
    const unused = invites.filter((i) => !i.used);
    if (unused.length === 0) {
      toast.error('Nenhum convite disponível para exportar.');
      return;
    }

    const esc = (v: unknown) => `"${(`${v ?? ''}`).replace(/"/g, '""')}"`;
    const baseUrl = window.location.origin;
    const header = 'Token,Link de Inscrição';
    const rows = unused.map(
      (i) => `${esc(i.token)},${esc(`${baseUrl}/e/${eventSlug}?token=${i.token}`)}`
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convites_${eventId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPublicLink = () => {
    const link = `${window.location.origin}/e/${eventSlug}`;
    navigator.clipboard.writeText(link);
    setCopiedPublicLink(true);
    setTimeout(() => setCopiedPublicLink(false), 2000);
  };

  const handleTogglePublic = async () => {
    setTogglingPublic(true);
    const newValue = !publicOpen;
    setPublicOpen(newValue);
    const { error } = await supabase.from('events').update({ is_open: newValue }).eq('id', eventId);
    if (error) {
      setPublicOpen(!newValue);
      toast.error('Erro ao alterar status: ' + error.message);
    }
    setTogglingPublic(false);
  };

  const handleCopyLink = (invite: Invite) => {
    const link = `${window.location.origin}/e/${eventSlug}?token=${invite.token}`;
    navigator.clipboard.writeText(link);
    setCopiedInviteId(invite.id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const whatsappUrl = (invite: Invite) => {
    const link = `${window.location.origin}/e/${eventSlug}?token=${invite.token}`;
    const msg = `Olá! Use este link para se inscrever no ${eventTitle}:\n\n${link}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

  const total = invites.length;
  const used = invites.filter((i) => i.used).length;
  const available = total - used;

  return (
    <Card className="bg-card backdrop-blur-md border-border shadow-lg">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-medium text-foreground">Inscrição de Uso Único</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {available} disponíveis · {used} utilizados · {total} total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground hidden md:inline-flex dark:bg-muted/50 dark:hover:bg-muted/70 dark:border-foreground/20"
            onClick={handleExportCsv}
            disabled={loading || generating}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground flex-1 sm:flex-none max-md:h-11 dark:bg-muted/50 dark:hover:bg-muted/70 dark:border-foreground/20"
            onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : () => handleGenerate(1)}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            Gerar 1
          </Button>
          <Button
            variant="outline"
            className="bg-card backdrop-blur-md border-border hover:bg-accent text-foreground flex-1 sm:flex-none max-md:h-11 dark:bg-muted/50 dark:hover:bg-muted/70 dark:border-foreground/20"
            onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : () => handleGenerate(100)}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            Gerar 100
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/50 p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-foreground">Link Público de Inscrição</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Qualquer pessoa com este link pode se inscrever no evento
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={publicOpen ? 'default' : 'secondary'} className="text-xs">
                {publicOpen ? 'Ativo' : 'Bloqueado'}
              </Badge>
          <Button
              variant={publicOpen ? 'destructive' : 'default'}
              size="sm"
              className="h-7 text-xs max-md:h-11 dark:bg-destructive/70 dark:hover:bg-destructive/80 dark:text-destructive-foreground"
              onClick={handleTogglePublic}
                disabled={togglingPublic}
              >
                {togglingPublic ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : null}
                {publicOpen ? 'Bloquear' : 'Desbloquear'}
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 text-xs bg-background rounded border border-border px-2 py-1.5 truncate font-mono">
              {window.location.origin}/e/{eventSlug}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0 max-md:h-11 dark:bg-muted/50 dark:hover:bg-muted/70 dark:border-foreground/20"
              onClick={handleCopyPublicLink}
            >
              {copiedPublicLink ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              {copiedPublicLink ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonMobileCard key={i} />)}
          </div>
        ) : inviteError ? (
          <div className="text-center py-8 text-destructive text-sm">
            <p className="font-medium">Erro ao carregar convites</p>
            <p className="text-muted-foreground mt-1">{inviteError}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Verifique se a migration 014_event_invites foi executada no Supabase.
            </p>
          </div>
        ) : invites.length === 0 ? (
          <EmptyState
            title="Nenhum convite gerado"
            description="Gere convites personalizados para controlar o acesso às inscrições."
          />
        ) : (
          <>
            {/* Mobile */}
            <div className="grid gap-2 md:hidden">
              {(mobileExpanded ? invites : invites.slice(0, MOBILE_LIMIT)).map((invite) => (
                <div key={invite.id} className="rounded-lg border border-border bg-muted p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={invite.used ? 'secondary' : 'default'}>
                      {invite.used ? 'Usado' : 'Disponível'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {!invite.used && (
                        <>
                          <Tooltip content="Copiar link">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 max-md:h-11 max-md:w-11 text-muted-foreground hover:text-foreground hover:bg-accent"
                              onClick={() => handleCopyLink(invite)}
                            >
                              {copiedInviteId === invite.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </Tooltip>
                          <Tooltip content="Compartilhar no WhatsApp">
                            <a
                              href={whatsappUrl(invite)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-7 w-7 max-md:h-11 max-md:w-11 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </Tooltip>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 max-md:h-11 max-md:w-11 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(invite.id)}
                        disabled={deletingId === invite.id}
                      >
                        {deletingId === invite.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-foreground truncate" title={invite.token}>
                    {invite.token.slice(0, 8)}...{invite.token.slice(-4)}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Criado: {formatDate(invite.created_at)}</span>
                    {invite.used_at && <span>Usado: {formatDate(invite.used_at)}</span>}
                  </div>
                </div>
              ))}
              {invites.length > MOBILE_LIMIT && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground max-md:h-11"
                  onClick={() => setMobileExpanded(!mobileExpanded)}
                >
                  {mobileExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" /> Mostrar menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" /> Mostrar mais ({invites.length - MOBILE_LIMIT} restantes)
                    </>
                  )}
                </Button>
              )}
            </div>
            {/* Desktop */}
            <div className="hidden md:block rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Token</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Criado em</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Usado em</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id} className="border-b border-border hover:bg-accent">
                      <td className="p-3 text-sm font-mono text-foreground">{invite.token}</td>
                      <td className="p-3 text-sm">
                        <Badge variant={invite.used ? 'secondary' : 'default'}>
                          {invite.used ? 'Usado' : 'Disponível'}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{formatDate(invite.created_at)}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {invite.used_at ? formatDate(invite.used_at) : '-'}
                      </td>
                      <td className="p-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!invite.used && (
                            <>
                              <Tooltip content="Copiar link">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                                  onClick={() => handleCopyLink(invite)}
                                >
                                  {copiedInviteId === invite.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                              </Tooltip>
                              <Tooltip content="Compartilhar no WhatsApp">
                                <a
                                  href={whatsappUrl(invite)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              </Tooltip>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(invite.id)}
                            disabled={deletingId === invite.id}
                          >
                            {deletingId === invite.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
