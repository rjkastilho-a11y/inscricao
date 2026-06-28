import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarDays, LogOut, Menu, X, Shield } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ChurchGuard } from '@/components/layout/ChurchGuard';
import { TrialBanner } from '@/components/layout/TrialBanner';
import { ChurchSwitcher } from '@/components/layout/ChurchSwitcher';

const NAV_ITEMS = [
  { to: '/app/eventos', label: 'Eventos', icon: CalendarDays },
];

export function AdminLayout() {
  const { user, isAdmin, isSuperAdmin, loading, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    );
  }

  return (
    <ChurchGuard>
      <div className="flex h-screen overflow-hidden print:overflow-visible print:h-auto bg-background antialiased text-foreground">
        {/* Gradientes decorativos */}
        <div aria-hidden className="pointer-events-none fixed -left-32 top-0 size-[500px] bg-[radial-gradient(circle,rgba(217,119,6,0.08)_0%,transparent_70%)] print:hidden" />
        <div aria-hidden className="pointer-events-none fixed -right-32 bottom-0 size-[400px] bg-[radial-gradient(circle,rgba(99,102,241,0.05)_0%,transparent_70%)] print:hidden" />

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex h-screen w-[280px] flex-col border-r border-border bg-card backdrop-blur-md shadow-xl transition-transform duration-200 lg:translate-x-0 print:hidden',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
            <Link to="/app/eventos" className="font-serif text-xl font-bold text-foreground">
              Kairós <span className="text-primary">Events</span>
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground max-md:h-11 max-md:w-11" onClick={() => setSidebarOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="border-b border-border px-3 py-2 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Contexto
              </p>
              <ChurchSwitcher />
            </div>
          )}

          <nav className="flex-1 space-y-1 overflow-y-auto p-2 scrollbar-thin">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border-l-2 border-transparent px-4 py-2.5 text-[15px] font-medium transition-all duration-150',
                  location.pathname.startsWith(item.to)
                    ? 'border-l-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}

            {isSuperAdmin && (
              <Link
                to="/app/master"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border-l-2 border-transparent px-4 py-2.5 text-[15px] font-medium transition-all duration-150',
                  location.pathname.startsWith('/app/master')
                    ? 'border-l-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Shield className="size-4" />
                Painel Master
              </Link>
            )}
          </nav>

          <div className="shrink-0 border-t border-border p-4">
            <div className="flex items-center justify-between">
              <span className="truncate text-[14px] text-muted-foreground">{user?.email}</span>
              <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-muted-foreground hover:text-foreground">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden print:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Conteúdo principal */}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:ml-[280px] print:ml-0 print:w-full">
          {/* Header mobile */}
          <div className="flex shrink-0 items-center border-b border-border bg-muted p-4 backdrop-blur-sm lg:hidden print:hidden">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground max-md:h-11 max-md:w-11">
              <Menu className="size-5" />
            </Button>
          </div>

          <TrialBanner />

          {/* Área de scroll do conteúdo */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 print:overflow-visible print:p-0 scrollbar-thin">
            <div className="mx-auto max-w-[1400px] w-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </ChurchGuard>
  );
}
