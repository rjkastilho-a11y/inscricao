import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navigate } from 'react-router-dom';
import { Building2, Plus, AlertCircle, Loader2, Lock, Unlock, Clock, MoreHorizontal, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface Church {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  status: string;
  trial_ends_at: string | null;
}

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

  useEffect(() => {
    if (isSuperAdmin) {
      loadChurches();
    }
  }, [isSuperAdmin]);

  const loadChurches = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('churches')
      .select('id, name, created_at, is_active, status, trial_ends_at')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Erro ao carregar igrejas:', fetchError.message);
    }
    const churchesData = (data as Church[]) || [];
    setChurches(churchesData);

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

    setLoading(false);
  };

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.rpc('delete_church', { p_church_id: deleteTarget.id });
    if (error) {
      setError(error.message);
      setDeleting(false);
      return;
    }
    setChurches(prev => prev.filter(c => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
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
                <div className="rounded-md border border-border overflow-hidden">
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
                          <td className="p-4 text-sm">
                            <Badge variant={church.is_active ? 'default' : 'destructive'}>
                              {church.is_active ? 'Ativo' : 'Bloqueado'}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm">
                            <div className="flex flex-col gap-1">
                              <Badge variant={
                                church.status === 'trial' ? 'secondary' :
                                church.status === 'suspended' ? 'destructive' :
                                'default'
                              }>
                                {church.status === 'trial' ? 'Trial' :
                                 church.status === 'suspended' ? 'Suspenso' :
                                 'Ativo'}
                              </Badge>
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
                                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors size-8">
                                  <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
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
