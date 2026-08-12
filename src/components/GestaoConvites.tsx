import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { copyToClipboard } from '@/lib/clipboard';
import { SkeletonMobileCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2, MessageCircle, ChevronDown, ChevronUp, Copy, Check, Link2, Globe, Lock, Unlock } from 'lucide-react';
import { useTrial } from '@/components/layout/ChurchGuard';

interface Invite {
  id: string;
  event_id: string;
  token: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
  recipient_name: string | null;
}

interface GestaoConvitesProps {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventIsOpen?: boolean;
}

interface RecipientNameCellProps {
  invite: Invite;
  isEditing: boolean;
  draftName: string;
  isSaving: boolean;
  onStartEdit: (invite: Invite) => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function RecipientNameCell({
  invite,
  isEditing,
  draftName,
  isSaving,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
}: RecipientNameCellProps) {
  if (isEditing) {
    return (
      <Input
        value={draftName}
        onChange={(e) => onDraftChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit();
          if (e.key === 'Escape') onCancel();
        }}
        className="h-8 w-full max-w-[220px] text-base md:text-sm"
        autoFocus
        disabled={isSaving}
        placeholder="Nome de quem vai receber"
      />
    );
  }

  return (
    <button
      type="button"
      className="w-full max-w-[220px] truncate rounded-lg px-2 py-1 text-left text-sm text-foreground hover:bg-accent"
      onClick={() => onStartEdit(invite)}
      title={invite.recipient_name ?? 'Clique para adicionar nome'}
    >
      {invite.recipient_name || <span className="text-muted-foreground">—</span>}
    </button>
  );
}

export default function GestaoConvites({ eventId, eventSlug, eventTitle, eventIsOpen: initialIsOpen }: GestaoConvitesProps) {
  console.log('[GestaoConvites] Renderizando com eventId:', eventId, 'eventSlug:', eventSlug);
  const trial = useTrial();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [eventIsOpen, setEventIsOpen] = useState(initialIsOpen ?? true);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [savingNameId, setSavingNameId] = useState<string | null>(null);
  const skipCommitRef = useRef(false);
  const MOBILE_LIMIT = 3;

  useEffect(() => {
    setEventIsOpen(initialIsOpen ?? true);
  }, [initialIsOpen]);

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

  const handleStartEditName = (invite: Invite) => {
    setDraftName(invite.recipient_name ?? '');
    setEditingNameId(invite.id);
  };

  const handleCancelEditName = () => {
    skipCommitRef.current = true;
    setEditingNameId(null);
    setDraftName('');
  };

  const handleCommitEditName = async () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setEditingNameId(null);
      setDraftName('');
      return;
    }
    if (!editingNameId) return;
    const id = editingNameId;
    const name = draftName.trim();
    setSavingNameId(id);
    const { error } = await supabase
      .from('event_invites')
      .update({ recipient_name: name || null })
      .eq('id', id);
    setSavingNameId(null);
    if (error) {
      toast.error('Erro ao salvar nome: ' + error.message);
    } else {
      setInvites((prev) =>
        prev.map((i) => (i.id === id ? { ...i, recipient_name: name || null } : i))
      );
    }
    handleCancelEditName();
  };

  const publicUrl = `${window.location.origin}/e/${eventSlug}`;

  const handleCopyPublicUrl = async () => {
    await copyToClipboard(publicUrl);
    setCopiedPublicUrl(true);
    setTimeout(() => setCopiedPublicUrl(false), 2000);
  };

  const handleToggleEventStatus = async () => {
    setTogglingStatus(true);
    const newValue = !eventIsOpen;
    setEventIsOpen(newValue);
    const { error } = await supabase.from('events').update({ is_open: newValue }).eq('id', eventId);
    if (error) {
      setEventIsOpen(!newValue);
      toast.error('Erro ao alterar status: ' + error.message);
    }
    setTogglingStatus(false);
  };

  const handleCopyLink = async (invite: Invite) => {
    const link = `${window.location.origin}/e/${eventSlug}?token=${invite.token}`;
    await copyToClipboard(link);
    setCopiedInviteId(invite.id);
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const whatsappUrl = (invite: Invite) => {
    const link = `${window.location.origin}/e/${eventSlug}?token=${invite.token}`;
    const msg = `Olá! Use este link para se inscrever no ${eventTitle}:\n\n${link}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

  return (
    <Card className="bg-card backdrop-blur-md border-border shadow-lg">
      {/* CARD 1: LINK PÚBLICO DO EVENTO */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-6 flex flex-col gap-4">
        {/* Cabeçalho do Link Público */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5 sm:mt-0">
              <Globe className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-foreground">Link Público do Evento</h3>
                <Badge variant={eventIsOpen ? 'default' : 'destructive'} className="text-[11px]">
                  {eventIsOpen ? 'Público Ativo' : 'Inscrições Bloqueadas'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate sm:whitespace-normal">
                Qualquer pessoa com este link pode se inscrever sem convite exclusivo.
              </p>
            </div>
          </div>

          {/* Toggle de Bloqueio do Evento */}
          <Button
            variant={eventIsOpen ? 'outline' : 'default'}
            size="sm"
            className="w-full sm:w-auto max-md:h-11 shrink-0 gap-1.5"
            onClick={handleToggleEventStatus}
            disabled={togglingStatus}
          >
            {togglingStatus ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : eventIsOpen ? (
              <Lock className="size-3.5 text-amber-500" />
            ) : (
              <Unlock className="size-3.5" />
            )}
            <span>{eventIsOpen ? 'Bloquear Inscrições' : 'Desbloquear Inscrições'}</span>
          </Button>
        </div>

        {/* Caixa de Cópia da URL Pública */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="flex-1 w-full relative">
            <Input
              readOnly
              value={publicUrl}
              className="font-mono text-xs pr-10 max-md:h-11 bg-muted/30"
            />
          </div>
          <Button
            variant="secondary"
            className="w-full sm:w-auto max-md:h-11 gap-2 font-medium shrink-0"
            onClick={handleCopyPublicUrl}
          >
            {copiedPublicUrl ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            <span>{copiedPublicUrl ? 'Copiado!' : 'Copiar Link Público'}</span>
          </Button>
        </div>
      </div>

      {/* CARD 2: TOOLBAR DE CONVITES EXCLUSIVOS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Convites Exclusivos</h3>
          <Badge variant="outline" className="text-xs font-mono">
            {invites.length}
          </Badge>
        </div>

        {/* Botões de Ação em Lote */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="max-md:h-11 gap-1.5"
            onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : () => handleGenerate(1)}
            disabled={generating}
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            <span>Gerar 1</span>
          </Button>
          <Button
            variant="outline"
            className="max-md:h-11 gap-1.5"
            onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : () => handleGenerate(100)}
            disabled={generating}
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            <span>Gerar 100</span>
          </Button>
        </div>
      </div>
      <CardContent className="space-y-4">
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
                <div 
                  key={invite.id} 
                  className={`rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3 transition-all ${invite.used ? 'opacity-60 bg-muted/50 grayscale-[0.2]' : ''}`}
                >
                  {/* CABEÇALHO: Identidade do Convite */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link2 className="size-4 text-primary shrink-0" />
                      <p className="text-sm font-mono font-bold text-foreground truncate" title={invite.token}>
                        {invite.token.slice(0, 8)}...{invite.token.slice(-4)}
                      </p>
                    </div>
                    <Badge variant={invite.used ? 'secondary' : 'default'} className={!invite.used ? 'bg-primary text-primary-foreground' : ''}>
                      {invite.used ? 'Usado' : 'Disponível'}
                    </Badge>
                  </div>

                  {/* CORPO: Destinatário e Datas */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground font-medium shrink-0">Para:</span>
                      <div className="flex-1 min-w-0">
                        <RecipientNameCell
                          invite={invite}
                          isEditing={editingNameId === invite.id}
                          draftName={draftName}
                          isSaving={savingNameId === invite.id}
                          onStartEdit={handleStartEditName}
                          onDraftChange={setDraftName}
                          onCommit={handleCommitEditName}
                          onCancel={handleCancelEditName}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Criado: {formatDate(invite.created_at)}</span>
                      {invite.used_at && <span className="font-medium text-foreground">Usado: {formatDate(invite.used_at)}</span>}
                    </div>
                  </div>

                  {/* RODAPÉ: Ações Rápidas (Action Bar) */}
                  <div className="flex items-center gap-2 pt-3 mt-1 border-t border-border/60">
                    {!invite.used ? (
                      <>
                        <Button
                          variant="secondary"
                          className="flex-1 h-10 max-md:h-11 gap-2 font-medium"
                          onClick={() => handleCopyLink(invite)}
                        >
                          {copiedInviteId === invite.id ? <Check className="size-4 text-emerald-600 dark:text-emerald-500" /> : <Copy className="size-4" />}
                          {copiedInviteId === invite.id ? 'Copiado' : 'Copiar'}
                        </Button>
                        <a
                          href={whatsappUrl(invite)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center h-10 max-md:h-11 rounded-md bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 font-semibold text-sm gap-2 transition-colors"
                        >
                          <MessageCircle className="size-4" />
                          WhatsApp
                        </a>
                      </>
                    ) : (
                      <div className="flex-1 text-xs text-muted-foreground text-center italic">
                        Convite já utilizado
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 max-md:h-11 max-md:w-11 text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleDelete(invite.id)}
                      disabled={deletingId === invite.id}
                    >
                      {deletingId === invite.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
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
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Enviado para</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Criado em</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Usado em</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id} className="border-b border-border hover:bg-accent">
                      <td className="p-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5 text-primary" />
                          <span className="font-mono">{invite.token}</span>
                          <Badge variant="default" className="text-[10px]">Exclusivo</Badge>
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        <RecipientNameCell
                          invite={invite}
                          isEditing={editingNameId === invite.id}
                          draftName={draftName}
                          isSaving={savingNameId === invite.id}
                          onStartEdit={handleStartEditName}
                          onDraftChange={setDraftName}
                          onCommit={handleCommitEditName}
                          onCancel={handleCancelEditName}
                        />
                      </td>
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
                              <Tooltip content="Copiar link exclusivo deste convite">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                                  onClick={() => handleCopyLink(invite)}
                                >
                                  {copiedInviteId === invite.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                              </Tooltip>
                              <Tooltip content="Compartilhar link exclusivo no WhatsApp">
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
