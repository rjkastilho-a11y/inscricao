import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Loader2, Undo2, Menu, X, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { EventProvider } from '@/contexts/EventContext';
import { useEvent } from '@/contexts/useEvent';
import { ChurchGuard, useTrial } from '@/components/layout/ChurchGuard';
import { TrialBanner } from '@/components/layout/TrialBanner';
import { useAuth } from '@/lib/auth';
import { useState, useCallback, useEffect, useRef } from 'react';

const NAV_GROUPS = [
  {
    label: 'Gestão',
    items: [
      { to: 'dashboard', label: 'Dashboard' },
      { to: 'inscricoes', label: 'Inscrições' },
      { to: 'financeiro', label: 'Financeiro' },
    ],
  },
  {
    label: 'Secretaria',
    items: [
      { to: 'convites', label: 'Convites' },
      { to: 'checkin-link', label: 'Check-in' },
      { to: 'grupos', label: 'Divisão de Grupos' },
      { to: 'etiquetas', label: 'Etiquetas' },
      { to: 'frequencia', label: 'Lista de Presença' },
      { to: 'formulario', label: 'Formulário' },
      { to: 'ficha-impressa', label: 'Ficha Impressa' },
      { to: 'configuracoes', label: 'Configurações' },
    ],
  },
];

const GATED_ITEMS = new Set(['convites', 'checkin-link', 'grupos', 'formulario', 'etiquetas', 'frequencia', 'ficha-impressa', 'configuracoes']);

function SidebarNav({ eventId, sidebarOpen, setSidebarOpen }: { eventId: string; sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const trial = useTrial();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex h-screen w-[280px] flex-col border-r border-border bg-card backdrop-blur-md shadow-xl transition-transform duration-200 lg:translate-x-0 print:hidden',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="shrink-0 border-b border-border">
        <div className="flex items-center justify-between p-4 pb-2">
          <Link to="/app/eventos" className="font-serif text-xl font-bold text-foreground">
            Kairós <span className="text-primary">Events</span>
          </Link>
        </div>
        <div className="flex items-center p-3 pt-0">
          <Link
            to="/app/eventos"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Eventos
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground max-md:h-11 max-md:w-11" onClick={() => setSidebarOpen(false)}>
              <X className="size-5" />
            </Button>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label} className={index > 0 ? 'mt-3 border-t border-border pt-4' : ''}>
            <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const to = `/app/evento/${eventId}/${item.to}`;
                const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
                const isGated = trial?.isTrialExceeded && GATED_ITEMS.has(item.to);
                return (
                  <Link
                    key={item.to}
                    to={isGated ? '#' : to}
                    onClick={(e) => {
                      if (isGated) { e.preventDefault(); trial.openUpgrade(); return; }
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border-l-2 border-transparent px-4 py-2.5 text-[15px] font-medium transition-all duration-150',
                      isActive
                        ? 'border-l-primary bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-4">
        <div className="flex items-center justify-between">
          <span className="truncate text-[14px] text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-muted-foreground hover:text-foreground max-md:h-11 max-md:w-11">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function MobileTabs({ eventId }: { eventId: string }) {
  const location = useLocation();
  const trial = useTrial();
  const activeTabRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [location.pathname]);

  return (
    <div className="flex w-full items-center gap-1.5 overflow-x-auto border-b border-border bg-background p-2 lg:hidden no-scrollbar print:hidden">
      {NAV_GROUPS.flatMap((group) => group.items).map((item) => {
        const to = `/app/evento/${eventId}/${item.to}`;
        const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
        const isGated = trial?.isTrialExceeded && GATED_ITEMS.has(item.to);
        return (
          <Link
            key={item.to}
            to={isGated ? '#' : to}
            ref={isActive ? activeTabRef : null}
            onClick={(e) => {
              if (isGated) { e.preventDefault(); trial.openUpgrade(); return; }
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap shrink-0 transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function EventLayoutContent() {
  const { event, eventId, loading, error } = useEvent();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const pathSegments = location.pathname.replace(/\/+$/, '').split('/');
  const eventIdx = pathSegments.indexOf('evento');
  const pageSegments = eventIdx !== -1 ? pathSegments.slice(eventIdx + 2) : [];
  const isDashboard = pageSegments.length === 1 && pageSegments[0] === 'dashboard';

  const handleBack = useCallback(() => {
    if (pageSegments.length > 1) {
      navigate(pathSegments.slice(0, -1).join('/') || '/');
    } else if (!isDashboard) {
      navigate(`/app/evento/${eventId}/dashboard`);
    }
  }, [pageSegments, pathSegments, isDashboard, navigate, eventId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !event || !eventId) {
    return <Navigate to="/app/eventos" replace />;
  }

  return (
    <ChurchGuard>
      <div className="flex h-screen overflow-hidden print:overflow-visible print:h-auto bg-background antialiased text-foreground">
        <div aria-hidden className="pointer-events-none fixed -left-32 top-0 size-[500px] bg-[radial-gradient(circle,rgba(217,119,6,0.08)_0%,transparent_70%)] print:hidden" />
        <div aria-hidden className="pointer-events-none fixed -right-32 bottom-0 size-[400px] bg-[radial-gradient(circle,rgba(99,102,241,0.05)_0%,transparent_70%)] print:hidden" />

        <SidebarNav eventId={eventId} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden print:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:ml-[280px] print:ml-0 print:w-full">
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted p-4 backdrop-blur-sm lg:hidden print:hidden">
            {!isDashboard && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0 max-md:h-11 max-md:w-11">
                <ArrowLeft className="size-5" />
              </Button>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-2 ml-1">
              <img src="/screenshots/Icone.png" alt="Kairós Events" className="h-6 w-auto shrink-0" />
              <div className="flex items-baseline gap-1 min-w-0 truncate">
                <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
                  Kairós
                </span>
                <span className="text-xs font-semibold uppercase text-[#F4B23A]" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.15em' }}>
                  EVENTS
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="ml-auto shrink-0 max-md:h-11 max-md:w-11">
              <Menu className="size-5" />
            </Button>
          </div>

          <MobileTabs eventId={eventId} />

          <TrialBanner />

          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 print:overflow-visible print:p-0 scrollbar-thin">
            <div className="mx-auto max-w-[1400px] w-full">
              {!isDashboard && (
                <button
                  onClick={handleBack}
                  className="hidden md:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 print:hidden"
                >
                  <Undo2 className="size-4" />
                  Voltar
                </button>
              )}
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </ChurchGuard>
  );
}

export function EventLayout() {
  return (
    <EventProvider>
      <EventLayoutContent />
    </EventProvider>
  );
}
