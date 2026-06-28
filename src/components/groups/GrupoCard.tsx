import { useEffect, useRef, useState, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { MoveRight, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

export interface Integrante {
  nome: string;
  registration_id?: string;
}

export interface GrupoRow {
  grupo_numero: number;
  genero_saida: string;
  integrantes: Integrante[];
  custom_name?: string;
}

interface GrupoCardProps {
  grupo: GrupoRow;
  allGroups: GrupoRow[];
  eventId: string;
  /** called after a successful DB move — parent should update local state */
  onMoveComplete: (memberName: string, sourceNumero: number, targetNumero: number) => void;
  onRename?: (grupoNumero: number, currentName: string) => void;
  onDeleteGroup?: (grupoNumero: number) => void;
}

/* ─── MonitorInput ─── */

function MonitorInput({ eventId, groupNumber }: { eventId: string; groupNumber: number }) {
  const [monitorName, setMonitorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchMonitor = async () => {
      const { data } = await supabase
        .from('group_assignments')
        .select('monitor_name')
        .eq('event_id', eventId)
        .eq('grupo_numero', groupNumber)
        .maybeSingle();

      if (!cancelled) {
        if (data?.monitor_name) setMonitorName(data.monitor_name);
        setLoading(false);
      }
    };
    fetchMonitor();
    return () => { cancelled = true; };
  }, [eventId, groupNumber]);

  const handleBlur = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('group_assignments')
        .select('id')
        .eq('event_id', eventId)
        .eq('grupo_numero', groupNumber)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('group_assignments')
          .update({ monitor_name: monitorName })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('group_assignments')
          .insert({ event_id: eventId, grupo_numero: groupNumber, monitor_name: monitorName });
      }
    } catch (err) {
      console.error('Erro ao salvar monitor:', err);
    }
    setSaving(false);
  };

  if (loading) return <div className="h-10 animate-pulse rounded-lg bg-slate-100" />;

  return (
    <div className="relative">
      <input
        type="text"
        value={monitorName}
        onChange={(e) => setMonitorName(e.target.value)}
        onBlur={handleBlur}
        placeholder="Monitor responsável..."
        className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
      />
      {saving && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
          salvando…
        </span>
      )}
    </div>
  );
}

const GrupoCard = memo(GrupoCardInner);
export default GrupoCard;

/* ─── GrupoCard ─── */

function GrupoCardInner({ grupo, allGroups, eventId, onMoveComplete, onRename, onDeleteGroup }: GrupoCardProps) {
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const otherGroups = allGroups.filter(
    (g) => g.grupo_numero !== grupo.grupo_numero
  );

  useEffect(() => {
    if (!openMenuFor) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuFor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuFor]);

  const handleMove = async (registrationId: string | undefined, targetGrupoNumero: number) => {
    console.log('🚀 handleMove chamado', { registrationId, targetGrupoNumero, source: grupo.grupo_numero });

    if (!registrationId) {
      console.warn('⚠️ registration_id ausente para', grupo.grupo_numero, targetGrupoNumero);
      return;
    }
    if (moving) return;
    setMoving(true);

    try {
      const { data: existing } = await supabase
        .from('group_assignments')
        .select('id')
        .eq('event_id', eventId)
        .eq('grupo_numero', targetGrupoNumero)
        .maybeSingle();

      let assignmentId = existing?.id;

      if (!assignmentId) {
        const { data: newAss, error: insertError } = await supabase
          .from('group_assignments')
          .insert({
            event_id: eventId,
            grupo_numero: targetGrupoNumero,
            genero: grupo.genero_saida,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('❌ Erro ao criar group_assignment:', insertError);
          setMoving(false);
          return;
        }
        assignmentId = (newAss as { id: string } | null)?.id;
      }

      if (!assignmentId) {
        console.error('❌ assignmentId é nulo');
        setMoving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('registrations')
        .update({ group_assignment_id: assignmentId })
        .eq('id', registrationId);

      if (updateError) {
        console.error('❌ Erro ao atualizar registration:', updateError);
        setMoving(false);
        return;
      }

      setOpenMenuFor(null);
      onMoveComplete(
        grupo.integrantes.find((i) => i.registration_id === registrationId)?.nome ?? '',
        grupo.grupo_numero,
        targetGrupoNumero
      );
    } catch (err) {
      console.error('❌ Erro ao mover integrante:', err);
    }

    setMoving(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">
          {grupo.custom_name || `Grupo ${grupo.grupo_numero} — ${grupo.genero_saida}`}
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Tooltip content="Renomear grupo">
              <button
                onClick={() => onRename?.(grupo.grupo_numero, grupo.custom_name || '')}
                className="flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
              >
                <Pencil className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Excluir grupo">
              <button
                onClick={() => onDeleteGroup?.(grupo.grupo_numero)}
                className="flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="size-3.5" />
              </button>
            </Tooltip>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            {grupo.integrantes.length}
          </span>
        </div>
      </div>

      <MonitorInput eventId={eventId} groupNumber={grupo.grupo_numero} />

      <div className="mt-4 space-y-1">
        {grupo.integrantes.length > 0 ? (
          grupo.integrantes.map((integrante, idx) => {
            const memberKey = integrante.registration_id ?? `g${grupo.grupo_numero}-${idx}`;

            return (
              <div
                key={memberKey}
                className="group relative flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-slate-50"
              >
                <span className="text-sm text-slate-600">
                  {integrante.nome}
                  {!integrante.registration_id && (
                    <span className="ml-2 text-[10px] font-medium text-red-400" title="sem ID no banco">
                      [sem ID]
                    </span>
                  )}
                </span>

                {otherGroups.length > 0 && (
                  <button
                    disabled={moving}
                    onClick={() =>
                      setOpenMenuFor(openMenuFor === memberKey ? null : memberKey)
                    }
                    className="flex size-7 items-center justify-center rounded-md text-slate-300 opacity-0 transition-all hover:bg-amber-50 hover:text-amber-600 group-hover:opacity-100 disabled:opacity-30"
                    title="Mover para outro grupo"
                  >
                    {moving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <MoveRight className="size-3.5" />
                    )}
                  </button>
                )}

                {openMenuFor === memberKey && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-full z-10 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    {otherGroups.map((g) => (
                      <button
                        key={g.grupo_numero}
                        onClick={() => handleMove(integrante.registration_id, g.grupo_numero)}
                        className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Mover para {g.custom_name || `Grupo ${g.grupo_numero} — ${g.genero_saida}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="py-2 text-sm italic text-slate-400">Nenhum integrante neste grupo</p>
        )}
      </div>
    </div>
  );
}
