import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Printer, RefreshCw, Plus, FileText, Grid3X3 } from 'lucide-react';
import GrupoCard, { type GrupoRow, type Integrante } from '@/components/groups/GrupoCard';
import { useEvent } from '@/contexts/EventContext';
import { useTrial } from '@/components/layout/ChurchGuard';

export default function GroupsPage() {
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { eventId, event } = useEvent();
  const trial = useTrial();
  const [grupos, setGrupos] = useState<GrupoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupGenero, setNewGroupGenero] = useState<'F' | 'M' | 'misto'>('misto');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printMode, setPrintMode] = useState<'single' | 'compact'>('single');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');

  /* ── Carregar grupos do banco (group_assignments + registrations) ── */
  const loadGroupsFromDb = useCallback(async (eventId: string): Promise<boolean> => {
    const { data: assignments } = await supabase
      .from('group_assignments')
      .select('id, grupo_numero, genero, custom_name')
      .eq('event_id', eventId)
      .order('grupo_numero');

    if (!assignments?.length) return false;

    const { data: regs } = await supabase
      .from('registrations')
      .select('id, full_name, group_assignment_id')
      .eq('event_id', eventId)
      .not('group_assignment_id', 'is', null)
      .neq('payment_status', 'canceled');

    const regMap = new Map<string, { id: string; full_name: string }[]>();
    for (const r of regs ?? []) {
      if (!r.group_assignment_id) continue;
      const list = regMap.get(r.group_assignment_id) ?? [];
      list.push({ id: r.id, full_name: r.full_name });
      regMap.set(r.group_assignment_id, list);
    }

    const grupos: GrupoRow[] = assignments.map((a) => ({
      grupo_numero: a.grupo_numero,
      genero_saida: a.genero ?? 'Não definido',
      integrantes: (regMap.get(a.id) ?? []).map((r) => ({
        nome: r.full_name,
        registration_id: r.id,
      })),
      custom_name: (a as any).custom_name || undefined,
    }));

    setGrupos(grupos);
    return true;
  }, []);

  /* ── Persistir resultado da RPC no banco ── */
  const persistRpcResult = useCallback(async (eventId: string, rpcData: any): Promise<GrupoRow[]> => {
    const { data: regs } = await supabase
      .from('registrations')
      .select('id, full_name')
      .eq('event_id', eventId)
      .neq('payment_status', 'canceled');

    const regList = (regs as { id: string; full_name: string }[] | null) ?? [];

    const normalize = (s: string) =>
      s?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';

    const nameToId = new Map<string, string>();
    for (const r of regList) {
      nameToId.set(r.full_name, r.id);
      nameToId.set(normalize(r.full_name), r.id);
    }

    const raw = (rpcData as any[] | null) ?? [];
    const result: GrupoRow[] = [];

    for (const g of raw) {
      const { data: ass } = await supabase
        .from('group_assignments')
        .insert({
          event_id: eventId,
          grupo_numero: g.grupo_numero,
          genero: g.genero_saida ?? 'Não definido',
        })
        .select('id')
        .single();

      if (!ass) continue;

      const integrantes: Integrante[] = [];
      for (const i of (g.integrantes ?? []) as any[]) {
        const regId = i.id ?? nameToId.get(i.nome) ?? nameToId.get(normalize(i.nome));
        if (regId) {
          await supabase
            .from('registrations')
            .update({ group_assignment_id: ass.id })
            .eq('id', regId);
        }
        integrantes.push({ nome: i.nome ?? '(sem nome)', registration_id: regId });
      }

      result.push({
        grupo_numero: g.grupo_numero,
        genero_saida: g.genero_saida ?? 'Não definido',
        integrantes,
      });
    }

    return result;
  }, []);

  /* ── Buscar/carregar grupos ── */
  const fetchGrupos = useCallback(async (eventId: string) => {
    if (!eventId) { setGrupos([]); return; }

    setLoading(true);
    setError(null);

    /* Tenta carregar do banco primeiro */
    const loaded = await loadGroupsFromDb(eventId);
    if (loaded) { setLoading(false); return; }

    /* Gera via RPC e persiste */
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('gerar_grupos_evento', { p_event_id: eventId });

    if (rpcError) {
      setError(rpcError.message);
      setGrupos([]);
      setLoading(false);
      return;
    }

    const normalizados = await persistRpcResult(eventId, rpcData);
    setGrupos(normalizados);
    setLoading(false);
  }, [loadGroupsFromDb, persistRpcResult]);

  useEffect(() => {
    fetchGrupos(eventId);
  }, [eventId, fetchGrupos]);

  /* ── Atualização otimista após mover integrante ── */
  const handleMoveComplete = (memberName: string, sourceNumero: number, targetNumero: number) => {
    if (!memberName) return;
    setGrupos((prev) => {
      const next = prev.map((g) => ({ ...g, integrantes: [...g.integrantes] }));
      const sourceGroup = next.find((g) => g.grupo_numero === sourceNumero);
      const targetGroup = next.find((g) => g.grupo_numero === targetNumero);
      if (!sourceGroup || !targetGroup) return prev;
      const idx = sourceGroup.integrantes.findIndex((i) => i.nome === memberName);
      if (idx === -1) return prev;
      const [moved] = sourceGroup.integrantes.splice(idx, 1);
      targetGroup.integrantes.push(moved);
      return next;
    });
  };

  /* ── Criar grupo avulso ── */
  const handleCreateCustomGroup = async () => {
    if (!eventId || !newGroupName.trim()) return;
    setCreatingGroup(true);

    const maxNumero = Math.max(...grupos.map((g) => g.grupo_numero), 0);
    const novoNumero = maxNumero + 1;

    const genero = newGroupGenero === 'misto' ? 'Avulso' : newGroupGenero;

    const { data: ass, error: insertError } = await supabase
      .from('group_assignments')
      .insert({
        event_id: eventId,
        grupo_numero: novoNumero,
        genero,
        custom_name: newGroupName.trim(),
      })
      .select('id')
      .single();

    if (insertError) {
      toast.error('Erro ao criar grupo: ' + insertError.message);
      setCreatingGroup(false);
      return;
    }

    setGrupos((prev) => [
      ...prev,
      {
        grupo_numero: novoNumero,
        genero_saida: genero,
        integrantes: [],
        custom_name: newGroupName.trim(),
      },
    ]);

    setCreateDialogOpen(false);
    setNewGroupName('');
    setNewGroupGenero('misto');
    setCreatingGroup(false);
  };

  /* ── Renomear grupo avulso ── */
  const handleRenameGroup = async () => {
    if (!eventId || renameTarget == null || !renameValue.trim()) return;
    setRenaming(true);

    const { error } = await supabase
      .from('group_assignments')
      .update({ custom_name: renameValue.trim() })
      .eq('event_id', eventId)
      .eq('grupo_numero', renameTarget);

    if (error) {
      toast.error('Erro ao renomear grupo: ' + error.message);
      setRenaming(false);
      return;
    }

    setGrupos((prev) =>
      prev.map((g) =>
        g.grupo_numero === renameTarget ? { ...g, custom_name: renameValue.trim() } : g
      )
    );

    setRenameDialogOpen(false);
    setRenaming(false);
  };

  /* ── Excluir grupo avulso ── */
  const handleDeleteGroup = async () => {
    if (!eventId || deleteTarget == null) return;
    setDeletingGroup(true);

    const { data: ass } = await supabase
      .from('group_assignments')
      .select('id')
      .eq('event_id', eventId)
      .eq('grupo_numero', deleteTarget)
      .single();

    if (ass) {
      await supabase
        .from('registrations')
        .update({ group_assignment_id: null })
        .eq('group_assignment_id', ass.id);

      await supabase
        .from('group_assignments')
        .delete()
        .eq('id', ass.id);
    }

    setGrupos((prev) => prev.filter((g) => g.grupo_numero !== deleteTarget));
    setDeleteConfirmOpen(false);
    setDeletingGroup(false);
  };

  /* ── Regenerar grupos ── */
  const handleRegenerate = async () => {
    if (!eventId) return;
    if (!window.confirm('Tem certeza? Todas as alterações manuais, grupos avulsos e monitores serão perdidos.')) return;

    setRegenerating(true);
    setError(null);

    await supabase
      .from('registrations')
      .update({ group_assignment_id: null })
      .eq('event_id', eventId);

    await supabase
      .from('group_assignments')
      .delete()
      .eq('event_id', eventId);

    await fetchGrupos(eventId);
    setRegenerating(false);
  };

  /* ── Imprimir PDF ── */
  const handlePrintPdf = (mode: 'single' | 'compact', orientation: 'portrait' | 'landscape') => {
    if (!grupos.length) return;

    const normalizeGenero = (v: string | undefined | null): string => {
      const lower = (v ?? '').toLowerCase();
      if (lower === 'f' || lower === 'feminino') return 'feminino';
      if (lower === 'm' || lower === 'masculino') return 'masculino';
      return lower;
    };
    const generoLabel: Record<string, string> = { f: 'Feminino', m: 'Masculino' };
    const displayGenero = (v: string | undefined | null) =>
      generoLabel[v?.toLowerCase() ?? ''] ?? v ?? '';

    const sorted = [...grupos].sort((a, b) =>
      normalizeGenero(a.genero_saida).localeCompare(normalizeGenero(b.genero_saida))
    );

    const mulheres = sorted.filter((g) => normalizeGenero(g.genero_saida) === 'feminino');
    const homens = sorted.filter((g) => normalizeGenero(g.genero_saida) === 'masculino');
    const outros = sorted.filter((g) => normalizeGenero(g.genero_saida) !== 'feminino' && normalizeGenero(g.genero_saida) !== 'masculino'
    );

    const eventTitle = event?.title ?? '';

    if (mode === 'single') {
      const sectionDefs = [
        { grupos: mulheres, label: 'Mulheres' },
        { grupos: homens, label: 'Homens' },
        { grupos: outros, label: 'Outros' },
      ].filter((s) => s.grupos.length);

      const sectionsHtml = sectionDefs
        .map((s, idx) => {
          const breakStyle = idx === 0 ? '' : ' style="page-break-before: always;"';
          const groupsHtml = s.grupos
            .map(
              (g) => `
            <div class="page">
              <div class="header">
                <h1>Grupo ${g.grupo_numero} — ${displayGenero(g.genero_saida)}</h1>
                <p class="total">Total: ${g.integrantes.length} integrante(s)</p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width:40px">#</th>
                    <th>Nome</th>
                  </tr>
                </thead>
                <tbody>
                  ${g.integrantes
                    .map(
                      (i, idx2) => `
                  <tr>
                    <td class="num">${idx2 + 1}</td>
                    <td>${i.nome}</td>
                  </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
            )
            .join('');

          return `<div class="section-header"${breakStyle}>${s.label}</div>${groupsHtml}`;
        })
        .join('');

      const total = sorted.reduce((s, g) => Math.max(s, g.integrantes.length), 0);
      const bodyFontSize = total > 25 ? '18px' : total > 15 ? '22px' : '26px';

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Grupos - ${eventTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; }
    .section-header {
      page-break-after: avoid;
      text-align: center;
      font-size: 28px;
      font-weight: 700;
      color: #333;
      padding: 20px 0 10px;
      letter-spacing: 2px;
    }
    .page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 16mm);
      justify-content: center;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 36px; letter-spacing: 1px; }
    .header .total { font-size: 18px; color: #555; margin-top: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${bodyFontSize};
    }
    th {
      background: #1a1a1a;
      color: #fff;
      padding: 10px 14px;
      text-align: left;
      font-weight: 700;
      font-size: ${bodyFontSize};
    }
    td {
      padding: 8px 14px;
      border-bottom: 1px solid #bbb;
    }
    td.num { text-align: center; color: #555; width: 50px; }
    tr:nth-child(even) td { background: #f0f0f0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${sectionsHtml}</body>
</html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 600);
      }
    } else {
      const isPortrait = orientation === 'portrait';
      const pageSize = isPortrait ? 'A4 portrait' : 'A4 landscape';
      const margin = '5mm';

      const renderGroupCard = (g: typeof sorted[number]) => `
        <div class="group-card">
          <div class="card-header">
            <strong>Grupo ${g.grupo_numero}${g.custom_name ? ` — ${g.custom_name}` : ''} (${displayGenero(g.genero_saida)})</strong>
            <span class="card-total">${g.integrantes.length} integrante(s)</span>
          </div>
          ${g.integrantes.length ? `
          <table>
            <thead>
              <tr>
                <th style="width:28px">#</th>
                <th>Nome</th>
              </tr>
            </thead>
            <tbody>
              ${g.integrantes
                .map(
                  (i, idx) => `
                <tr>
                  <td class="num">${idx + 1}</td>
                  <td>${i.nome}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>` : '<p class="empty">Sem integrantes</p>'}
        </div>`;

      const sectionDefs = [
        { grupos: mulheres, label: 'Mulheres' },
        { grupos: homens, label: 'Homens' },
        { grupos: outros, label: 'Outros' },
      ].filter((s) => s.grupos.length);

      const sectionsHtml = sectionDefs
        .map((s, idx) => {
          const breakStyle = idx === 0 ? '' : ' page-break-before: always;';
          return `<div class="section-wrapper" style="${breakStyle}">
          <div class="section-label">${s.label}</div>
          <div class="section-grid">
            ${s.grupos.map(renderGroupCard).join('')}
          </div>
        </div>`;
        })
        .join('');

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Grupos - ${eventTitle}</title>
  <style>
    @page { size: ${pageSize}; margin: ${margin}; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1a1a1a;
    }
    .section-label {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      color: #333;
      padding: 10px 0 6px;
      letter-spacing: 1px;
      page-break-after: avoid;
    }
    .section-grid {
      column-count: 2;
      column-gap: 5mm;
    }
    .group-card {
      break-inside: avoid;
      margin-bottom: 4mm;
      border: 1px solid #999;
      border-radius: 3px;
      padding: 4mm 3mm;
      background: #fff;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3mm;
      font-size: 12px;
    }
    .card-header strong { font-size: 13px; }
    .card-total {
      font-size: 10px;
      color: #666;
      background: #eee;
      padding: 1px 6px;
      border-radius: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    th {
      background: #1a1a1a;
      color: #fff;
      padding: 3px 5px;
      text-align: left;
      font-weight: 700;
      font-size: 10px;
    }
    td {
      padding: 2px 5px;
      border-bottom: 1px solid #ccc;
    }
    td.num { text-align: center; color: #555; width: 28px; }
    tr:nth-child(even) td { background: #f5f5f5; }
    .empty {
      font-size: 10px;
      color: #999;
      font-style: italic;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${sectionsHtml}</body>
</html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 600);
      }
    }
  };

  /* ── Loading inicial ── */
  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Divisão de Grupos"
        badge={event?.title}
        description="Visualize, atribua monitores e mova participantes entre os grupos"
      />

      {error && (
        <div className="mb-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <p className="font-medium">Erro ao carregar grupos</p>
          <p className="mt-1 text-red-600/80">{error}</p>
        </div>
      )}

      {loading && (
        <div className="py-4">
          <SkeletonTable rows={5} columns={4} />
        </div>
      )}

      {!loading && !error && eventId && Array.isArray(grupos) && grupos.length === 0 && (
        <EmptyState
          title="Nenhum grupo encontrado"
          description="Grupos serão criados automaticamente ao distribuir os inscritos. Use o botão 'Gerar grupos' para começar."
        />
      )}

      {!loading && !error && Array.isArray(grupos) && grupos.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted"
            >
              {regenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Regenerar
            </button>
            <button
              onClick={() => { setPrintMode('single'); setPrintOrientation('portrait'); setPrintDialogOpen(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
            >
              <Printer className="size-4" />
              Imprimir PDF
            </button>
            <button
              onClick={trial?.isTrialExceeded ? () => trial.openUpgrade() : () => { setNewGroupName(''); setNewGroupGenero('misto'); setCreateDialogOpen(true); }}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60"
            >
              <Plus className="size-4" />
              Criar Grupo Avulso
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {grupos.map((grupo) => (
              <GrupoCard
                key={`${grupo.grupo_numero}-${grupo.genero_saida}-${grupo.custom_name || ''}`}
                grupo={grupo}
                allGroups={grupos}
                eventId={eventId}
                onMoveComplete={handleMoveComplete}
                onRename={(num, name) => { setRenameTarget(num); setRenameValue(name); setRenameDialogOpen(true); }}
                onDeleteGroup={(num) => { setDeleteTarget(num); setDeleteConfirmOpen(true); }}
              />
            ))}
          </div>
        </>
      )}

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opções de Impressão</DialogTitle>
            <DialogDescription>
              Escolha o formato de impressão dos grupos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${printMode === 'single' ? 'border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-border dark:hover:bg-muted'}`}>
              <input
                type="radio"
                name="printMode"
                className="mt-1"
                checked={printMode === 'single'}
                onChange={() => setPrintMode('single')}
              />
               <div>
                 <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-foreground">
                   <FileText className="size-4 text-amber-600" />
                   1 grupo por folha
                 </div>
                 <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                   Cada grupo ocupa uma folha inteira no formato paisagem. Ideal para visualização ampla.
                 </p>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${printMode === 'compact' ? 'border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-border dark:hover:bg-muted'}`}>
              <input
                type="radio"
                name="printMode"
                className="mt-1"
                checked={printMode === 'compact'}
                onChange={() => setPrintMode('compact')}
              />
               <div>
                 <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-foreground">
                   <Grid3X3 className="size-4 text-amber-600" />
                   Vários grupos por folha
                 </div>
                 <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                   2 colunas por página. Grupos femininos e masculinos agrupados separadamente.
                 </p>
              </div>
            </label>

            {printMode === 'compact' && (
              <div className="space-y-2 pl-7">
                <p className="text-sm font-medium text-slate-700 dark:text-muted-foreground">Orientação da página:</p>
                <label className={`mr-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 transition-colors ${printOrientation === 'portrait' ? 'border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-border dark:hover:bg-muted'}`}>
                  <input
                    type="radio"
                    name="printOrientation"
                    className="mt-0"
                    checked={printOrientation === 'portrait'}
                    onChange={() => setPrintOrientation('portrait')}
                  />
                  <span className="text-sm">Retrato</span>
                </label>
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 transition-colors ${printOrientation === 'landscape' ? 'border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/40' : 'border-slate-200 hover:bg-slate-50 dark:border-border dark:hover:bg-muted'}`}>
                  <input
                    type="radio"
                    name="printOrientation"
                    className="mt-0"
                    checked={printOrientation === 'landscape'}
                    onChange={() => setPrintOrientation('landscape')}
                  />
                  <span className="text-sm">Paisagem</span>
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
              onClick={() => {
                setPrintDialogOpen(false);
                handlePrintPdf(printMode, printOrientation);
              }}
            >
              <Printer className="mr-1 size-4" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Grupo Avulso</DialogTitle>
            <DialogDescription>
              Defina um nome e o gênero do novo grupo. Participantes poderão ser movidos para ele através do menu "Mover para" em cada card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="group-name">Nome do grupo</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: Recepção, Louvor, Som..."
                autoFocus
              />
            </div>
            <div>
              <Label>Gênero</Label>
              <div className="mt-1 flex gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="newGroupGenero"
                    checked={newGroupGenero === 'F'}
                    onChange={() => setNewGroupGenero('F')}
                    className="size-4"
                  />
                  Feminino
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="newGroupGenero"
                    checked={newGroupGenero === 'M'}
                    onChange={() => setNewGroupGenero('M')}
                    className="size-4"
                  />
                  Masculino
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="newGroupGenero"
                    checked={newGroupGenero === 'misto'}
                    onChange={() => setNewGroupGenero('misto')}
                    className="size-4"
                  />
                  Misto
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creatingGroup}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600/80 text-white hover:bg-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800"
              onClick={handleCreateCustomGroup}
              disabled={creatingGroup || !newGroupName.trim()}
            >
              {creatingGroup ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Criando...</> : 'Criar Grupo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Grupo</DialogTitle>
            <DialogDescription>
              Altere o nome do grupo avulso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="rename-name">Nome do grupo</Label>
              <Input
                id="rename-name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Ex: Recepção, Louvor, Som..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={renaming}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600/80 text-white hover:bg-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800"
              onClick={handleRenameGroup}
              disabled={renaming || !renameValue.trim()}
            >
              {renaming ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Grupo</DialogTitle>
            <DialogDescription>
              {grupos.find((g) => g.grupo_numero === deleteTarget)?.integrantes.length
                ? `Este grupo possui ${grupos.find((g) => g.grupo_numero === deleteTarget)!.integrantes.length} integrante(s) que serão removidos do grupo.`
                : 'Tem certeza que deseja excluir este grupo?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deletingGroup}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={deletingGroup}
            >
              {deletingGroup ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Excluindo...</> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
