import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Church {
  id: string;
  name: string;
}

export function ChurchSwitcher() {
  const { churchId } = useAuth();
  const [open, setOpen] = useState(false);
  const [churches, setChurches] = useState<Church[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    supabase
      .from('churches')
      .select('id, name')
      .order('name')
      .then(({ data }) => setChurches(data || []));
  }, []);

  const active = churches.find((c) => c.id === churchId);

  const switchChurch = async (id: string) => {
    if (id === churchId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    const { error } = await supabase.rpc('set_active_church', { p_church_id: id });
    if (error) {
      toast.error(error.message);
      setSwitching(false);
      return;
    }
    await supabase.auth.refreshSession();
    setSwitching(false);
    setOpen(false);
    window.location.reload();
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-between text-xs h-auto py-1.5"
        onClick={() => setOpen(!open)}
        disabled={switching}
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          <Building2 className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{active?.name || 'Selecionar igreja'}</span>
        </span>
        <ChevronsUpDown className="size-3 shrink-0 opacity-50 ml-1" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border bg-popover p-1 shadow-md max-h-48 overflow-y-auto">
            {churches.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                Nenhuma igreja encontrada
              </p>
            )}
            {churches.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`w-full text-left px-2 py-1.5 text-xs rounded-sm flex items-center gap-2 transition-colors ${
                  c.id === churchId
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-accent'
                }`}
                onClick={() => switchChurch(c.id)}
              >
                {c.id === churchId && <Check className="size-3 shrink-0" />}
                {c.id !== churchId && <span className="size-3 shrink-0" />}
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
