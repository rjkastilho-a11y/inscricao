import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { EventLayout } from '@/components/layout/EventLayout';
import { Skeleton } from '@/components/ui/skeleton';

const LandingPage = lazy(() => import('@/pages/public/LandingPage'));
const EventRegistration = lazy(() => import('@/pages/public/EventRegistration'));
const CheckinPage = lazy(() => import('@/pages/public/CheckinPage'));
const LoginPage = lazy(() => import('@/pages/public/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/public/RegisterPage'));
const ResetPasswordPage = lazy(() => import('@/pages/public/ResetPasswordPage'));
const UpdatePasswordPage = lazy(() => import('@/pages/public/UpdatePasswordPage'));
const TermsOfUsePage = lazy(() => import('@/pages/public/TermsOfUsePage'));

const EventsPage = lazy(() => import('@/pages/admin/EventsPage'));
const EventNewPage = lazy(() => import('@/pages/admin/EventNewPage'));
const EventDetailPage = lazy(() => import('@/pages/admin/EventDetailPage'));
const EventEditPage = lazy(() => import('@/pages/admin/EventEditPage'));
const MasterDashboardPage = lazy(() => import('@/pages/admin/MasterDashboardPage'));

const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const RegistrationsPage = lazy(() => import('@/pages/admin/RegistrationsPage'));
const RegistrationNewPage = lazy(() => import('@/pages/admin/RegistrationNewPage'));
const RegistrationDetailPage = lazy(() => import('@/pages/admin/RegistrationDetailPage'));
const RegistrationEditPage = lazy(() => import('@/pages/admin/RegistrationEditPage'));
const FinancialPage = lazy(() => import('@/pages/admin/FinancialPage'));
const GroupsPage = lazy(() => import('@/pages/admin/GroupsPage'));
const EtiquetasPage = lazy(() => import('@/pages/admin/EtiquetasPage'));
const ConvitesPage = lazy(() => import('@/pages/admin/ConvitesPage'));
const EventSettingsPage = lazy(() => import('@/pages/admin/EventSettingsPage'));
const FrequenciaPage = lazy(() => import('@/pages/admin/FrequenciaPage'));
const FormBuilderPage = lazy(() => import('@/pages/admin/FormBuilderPage'));
const FichaImpressaPage = lazy(() => import('@/pages/admin/FichaImpressaPage'));
const CheckinLinkPage = lazy(() => import('@/pages/admin/CheckinLinkPage'));

function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

function SuspensePage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  { path: '/', element: <SuspensePage><LandingPage /></SuspensePage> },
  { path: '/e/:slug', element: <SuspensePage><EventRegistration /></SuspensePage> },
  { path: '/e/:slug/checkin', element: <SuspensePage><CheckinPage /></SuspensePage> },
  { path: '/login', element: <SuspensePage><LoginPage /></SuspensePage> },
  { path: '/register', element: <SuspensePage><RegisterPage /></SuspensePage> },
  { path: '/reset-password', element: <SuspensePage><ResetPasswordPage /></SuspensePage> },
  { path: '/update-password', element: <SuspensePage><UpdatePasswordPage /></SuspensePage> },
  { path: '/termos', element: <SuspensePage><TermsOfUsePage /></SuspensePage> },

  {
    path: '/app',
    element: <ProtectedRoute><AdminLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/app/eventos" replace /> },
      { path: 'eventos', element: <SuspensePage><EventsPage /></SuspensePage> },
      { path: 'eventos/novo', element: <SuspensePage><EventNewPage /></SuspensePage> },
      { path: 'eventos/:id', element: <SuspensePage><EventDetailPage /></SuspensePage> },
      { path: 'eventos/:id/editar', element: <SuspensePage><EventEditPage /></SuspensePage> },
      { path: 'configuracoes', element: <Navigate to="/app/eventos" replace /> },
      { path: 'master', element: <SuspensePage><MasterDashboardPage /></SuspensePage> },
    ],
  },

  {
    path: '/app/evento/:eventId',
    element: <ProtectedRoute><EventLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <SuspensePage><DashboardPage /></SuspensePage> },
      { path: 'inscricoes', element: <SuspensePage><RegistrationsPage /></SuspensePage> },
      { path: 'inscricoes/nova', element: <SuspensePage><RegistrationNewPage /></SuspensePage> },
      { path: 'inscricoes/:id', element: <SuspensePage><RegistrationDetailPage /></SuspensePage> },
      { path: 'inscricoes/:id/editar', element: <SuspensePage><RegistrationEditPage /></SuspensePage> },
      { path: 'financeiro', element: <SuspensePage><FinancialPage /></SuspensePage> },
      { path: 'grupos', element: <SuspensePage><GroupsPage /></SuspensePage> },
      { path: 'etiquetas', element: <SuspensePage><EtiquetasPage /></SuspensePage> },
      { path: 'convites', element: <SuspensePage><ConvitesPage /></SuspensePage> },
      { path: 'frequencia', element: <SuspensePage><FrequenciaPage /></SuspensePage> },
      { path: 'formulario', element: <SuspensePage><FormBuilderPage /></SuspensePage> },
      { path: 'ficha-impressa', element: <SuspensePage><FichaImpressaPage /></SuspensePage> },
      { path: 'checkin-link', element: <SuspensePage><CheckinLinkPage /></SuspensePage> },
      { path: 'configuracoes', element: <SuspensePage><EventSettingsPage /></SuspensePage> },
    ],
  },
]);
