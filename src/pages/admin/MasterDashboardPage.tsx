import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navigate } from 'react-router-dom';
import { Building2, Plus, AlertCircle, Loader2, Lock, Unlock, Clock, MoreHorizontal, Trash2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Church, PlanType } from '@/types/database';

const MASTER_EMAIL = 'rj.kastilho@gmail.com';

export default function MasterDashboardPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminEmails, setAdminEmails] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Church | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [liberateTarget, setLiberateTarget] = useState<Church | null>(null);
  const [liberating, setLiberating] = useState(false);
  const [pendingUserIds, setPendingUserIds] = useState<string[] | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [serviceKey, setServiceKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [deletingAuth, setDeletingAuth] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isSuperAdmin) {
      loadChurches();
    }
  }, [isSuperAdmin]);

  async function loadChurches() {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('churches')
      .select('id, name, created_at, is_active, status, trial_ends_at, plan_type, is_vip')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Erro ao carregar igrejas:', fetchError.message);
    }
    let churchesData = (data as Church[]) || [];

    const results = await Promise.all(
      churchesData.map((c) =>
        supabase.rpc('get_first_admin_email', { p_church_id: c.id }).then(({ data: email }) => [c.id, email ?? ''] as const)
      )
    );
    const emailMap: Record<string, string> = {};
    for (const [id, email] of results) {
      if (email) emailMap[id] = email;
    }
    setAdminEmails(emailMap);

    // Ocultar a conta Master (rj.kastilho@gmail.com) para evitar exclusão acidental
    churchesData = churchesData.filter((c) => {
      const email = emailMap[c.id];
      return !email || email.toLowerCase() !== MASTER_EMAIL.toLowerCase();
    });
    setChurches(churchesData);

    setLoading(false);
  }

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setCreating(true);
    setError(null);

    const { error: insertError } = await supabase
      .from('churches')
      .insert({ name: newName.trim() });

    if (insertError) {
      setError(insertError.message);
      setCreating(false);
      return;
    }

    setNewName('');
    setCreating(false);
    loadChurches();
  };

  const handleToggleActive = async (church: Church) => {
    const { error: updateError } = await supabase
      .from('churches')
      .update({ is_active: !church.is_active })
      .eq('id', church.id);

    if (updateError) {
      console.error('Erro ao alterar status:', updateError.message);
      return;
    }

    setChurches(prev =>
      prev.map(c => c.id === church.id ? { ...c, is_active: !c.is_active } : c)
    );
  };

  // ============================================================
  // Atualização Otimista — Plano (Mensal/Anual)
  // UI responde imediatamente; reconcilia com a resposta da RPC;
  // faz rollback para o snapshot em caso de erro.
  // ============================================================
  const handleChangePlan = async (church: Church, newPlan: PlanType) => {
    const snapshot = church;

    setUpdatingIds(prev => new Set(prev).add(church.id));

    setChurches(prev =>
      prev.map(c =>
        c.id === church.id
          ? newPlan === 'annual'
            ? { ...c, plan_type: newPlan, status: 'active', is_active: true, trial_ends_at: null }
            : { ...c, plan_type: newPlan }
          : c
      )
    );

    const { data, error } = await supabase.rpc('admin_update_church_plan', {
      target_church_id: church.id,
      new_plan: newPlan,
      set_vip: church.is_vip,
    });

    setUpdatingIds(prev => {
      const next = new Set(prev);
      next.delete(church.id);
      return next;
    });

    if (error) {
      setChurches(prev => prev.map(c => (c.id === church.id ? snapshot : c)));
      toast.error(error.message);
      return;
    }

    if (data) {
      setChurches(prev => prev.map(c => (c.id === church.id ? (data as Church) : c)));
    }

    toast.success(`Plano alterado para ${newPlan === 'annual' ? 'Anual' : 'Mensal'}`);
  };

  // ============================================================
  // Atualização Otimista — Chancela VIP
  // ============================================================
  const handleToggleVip = async (church: Church) => {
    const snapshot = church;
    const nextVip = !church.is_vip;

    setUpdatingIds(prev => new Set(prev).add(church.id));

    setChurches(prev =>
      prev.map(c =>
        c.id === church.id
          ? nextVip
            ? { ...c, is_vip: nextVip, status: 'active', is_active: true, trial_ends_at: null }
            : { ...c, is_vip: nextVip }
          : c
      )
    );

    const { data, error } = await supabase.rpc('admin_update_church_plan', {
      target_church_id: church.id,
      new_plan: church.plan_type,
      set_vip: nextVip,
    });

    setUpdatingIds(prev => {
      const next = new Set(prev);
      next.delete(church.id);
      return next;
    });

    if (error) {
      setChurches(prev => prev.map(c => (c.id === church.id ? snapshot : c)));
      toast.error(error.message);
      return;
    }

    if (data) {
      setChurches(prev => prev.map(c => (c.id === church.id ? (data as Church) : c)));
    }

    toast.success(nextVip ? 'Chancela VIP concedida' : 'Chancela VIP revogada');
  };

  const handleLiberarAcesso = async () => {
    if (!liberateTarget) return;
    setLiberating(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('churches')
      .update({
        status: 'active',
        is_active: true,
        trial_ends_at: null,
        trial_suspended_at: null,
        deleted_at: null,
      })
      .eq('id', liberateTarget.id);

    if (updateError) {
      setError(updateError.message);
      setLiberating(false);
      return;
    }

    setChurches(prev =>
      prev.map(c => c.id === liberateTarget.id ? { ...c, status: 'active', is_active: true, trial_ends_at: null } : c)
    );
    setLiberateTarget(null);
    setLiberating(false);
    toast.success(`Acesso liberado para ${liberateTarget.name}`);
    loadChurches();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const { data: userIds, error } = await supabase.rpc('delete_church', { p_church_id: deleteTarget.id });
    if (error) {
      setError(error.message);
      setDeleting(false);
      return;
    }

    const failedIds: string[] = [];

    if (userIds && userIds.length > 0) {
      const siteUrl = window.location.origin;
      for (const uid of userIds) {
        try {
          const res = await fetch(`${siteUrl}/.netlify/functions/delete-auth-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: uid }),
          });
          if (!res.ok) failedIds.push(uid);
        } catch {
          failedIds.push(uid);
        }
      }
    }

    setChurches(prev => prev.filter(c => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);

    if (failedIds.length > 0) {
      setPendingUserIds(failedIds);
      toast.success('Igreja excluída com sucesso', {
        description: 'Para liberar o e-mail e testar novo cadastro, clique em "Liberar e-mail".',
        action: {
          label: 'Liberar e-mail',
          onClick: () => setShowKeyDialog(true),
        },
        duration: 10000,
      });
    } else {
      toast.success('Igreja excluída com sucesso');
    }
  };

  const handleDeleteAuthUser = async () => {
    if (!pendingUserIds || !serviceKey.trim()) return;
    setDeletingAuth(true);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    let successCount = 0;

    for (const uid of pendingUserIds) {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${uid}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apiKey': serviceKey.trim(),
            'Authorization': `Bearer ${serviceKey.trim()}`,
          },
        });
        if (res.ok) successCount++;
      } catch {
        // ignora
      }
    }

    setDeletingAuth(false);
    setShowKeyDialog(false);
    setServiceKey('');
    setPendingUserIds(null);

    if (successCount > 0) {
      toast.success(`${successCount} usuário(s) liberado(s) com sucesso!`);
    } else {
      toast.error('Não foi possível liberar o e-mail. Verifique a chave e tente novamente.');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/app/eventos" replace />;
  }

  return (
    <div>
      <PageHeader
        title="Painel Master"
        description="Gerencie os clientes (igrejas) da plataforma Kairós Events"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulário de criação */}
        <div className="lg:col-span-1">
          <Card className="bg-card backdrop-blur-md border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Plus className="size-5" />
                Nova Igreja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="church-name" className="text-foreground">
                  Nome da Nova Igreja
                </Label>
                <Input
                  id="church-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Igreja Batista Central"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? 'Criando...' : 'Criar Cliente'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Clientes */}
        <div className="lg:col-span-2">
          <Card className="bg-card backdrop-blur-md border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Building2 className="size-5" />
                Clientes ({churches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : churches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma igreja cadastrada ainda.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-accent">
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                          Nome
                        </th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                          Plano
                        </th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                          VIP
                        </th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                          E-mail
                        </th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                          Criada em
                        </th>
                        <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {churches.map((church) => (
                        <tr
                          key={church.id}
                          className="border-b border-border hover:bg-accent"
                        >
                          <td className="p-4 text-sm font-medium text-foreground">
                            {church.name}
                          </td>

                          {/* Status: Ativa / Suspensa / Trial + Bloqueada */}
                          <td className="p-4 text-sm">
                            <div className="flex flex-col gap-1">
                              <Badge variant={
                                church.status === 'suspended' ? 'destructive' :
                                church.status === 'trial' ? 'secondary' :
                                'default'
                              }>
                                {church.status === 'suspended' ? 'Suspensa' :
                                 church.status === 'trial' ? 'Trial' :
                                 'Ativa'}
                              </Badge>
                              {!church.is_active && (
                                <Badge variant="destructive">
                                  <Lock className="size-3" />
                                  Bloqueada
                                </Badge>
                              )}
                              {church.status === 'trial' && church.trial_ends_at && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {new Date(church.trial_ends_at) > new Date()
                                    ? `expira em ${new Date(church.trial_ends_at).toLocaleDateString('pt-BR')}`
                                    : 'expirado'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Plano: seletor Mensal/Anual */}
                          <td className="p-4 text-sm">
                            <Select
                              value={church.plan_type}
                              onValueChange={(v) => handleChangePlan(church, v as PlanType)}
                              disabled={updatingIds.has(church.id)}
                            >
                              <SelectTrigger size="sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monthly">Mensal</SelectItem>
                                <SelectItem value="annual">Anual</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>

                          {/* VIP: toggle de chancela */}
                          <td className="p-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={church.is_vip}
                                onCheckedChange={() => handleToggleVip(church)}
                                disabled={updatingIds.has(church.id)}
                              />
                              <Badge
                                variant={church.is_vip ? 'default' : 'outline'}
                                className={church.is_vip ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' : 'text-muted-foreground'}
                              >
                                <Sparkles className="size-3" />
                                {church.is_vip ? 'VIP' : 'Padrão'}
                              </Badge>
                            </div>
                          </td>

                          <td className="p-4 text-sm text-muted-foreground">
                            {adminEmails[church.id] || '-'}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {formatDate(church.created_at)}
                          </td>
                          <td className="p-4 text-sm text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleActive(church)}
                              >
                                {church.is_active ? (
                                  <Lock className="size-4 mr-1" />
                                ) : (
                                  <Unlock className="size-4 mr-1" />
                                )}
                                {church.is_active ? 'Bloquear' : 'Ativar'}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors size-8">
                                  <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {church.status !== 'active' && (
                                    <DropdownMenuItem
                                      className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                                      onClick={() => setLiberateTarget(church)}
                                    >
                                      <Sparkles className="size-4 mr-2" />
                                      Liberar Acesso
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={() => setDeleteTarget(church)}
                                  >
                                    <Trash2 className="size-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showKeyDialog} onOpenChange={(open) => { if (!open) { setShowKeyDialog(false); setServiceKey(''); }}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar e-mail para novo cadastro</DialogTitle>
            <DialogDescription>
              O auth user não foi removido porque a Netlify Function não está disponível neste ambiente.
              Cole abaixo a chave <strong>service_role</strong> do Supabase para liberar manualmente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Encontre a chave em: <strong>Supabase → Project Settings → API → service_role key</strong>
            </p>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={serviceKey}
                onChange={(e) => setServiceKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowKeyDialog(false); setServiceKey(''); }} disabled={deletingAuth}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteAuthUser} disabled={deletingAuth || !serviceKey.trim()}>
              {deletingAuth ? 'Liberando...' : 'Liberar e-mail'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!liberateTarget} onOpenChange={(open) => !open && setLiberateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar Acesso Completo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja liberar acesso completo para <strong>{liberateTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Esta ação irá:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ativar o plano da igreja</li>
              <li>Remover as restrições de trial (limite de inscrições e expiração)</li>
              <li>Reativar a conta se estiver suspensa ou bloqueada</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiberateTarget(null)} disabled={liberating}>Cancelar</Button>
            <Button onClick={handleLiberarAcesso} disabled={liberating}>
              {liberating ? 'Liberando...' : 'Liberar Acesso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Igreja</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Esta ação irá:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Liberar o e-mail para novo cadastro</li>
              <li>Remover todos os dados: eventos, inscrições, financeiro e configurações</li>
            </ul>
            <p className="text-destructive font-medium">Esta ação não pode ser desfeita.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
