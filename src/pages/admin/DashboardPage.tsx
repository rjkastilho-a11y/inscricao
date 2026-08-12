import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonStatCard, SkeletonTable, SkeletonMobileCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, paymentStatusLabels, paymentMethodLabels } from '@/lib/utils';
import { useEvent } from '@/contexts/useEvent';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { Building2, Lock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTrial } from '@/components/layout/ChurchGuard';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { fetchFormFields } from '@/lib/form-fields';
import type { FormStep } from '@/lib/form-fields';

interface EventStat {
  eventId: string;
  title: string;
  is_open: boolean;
  start_date: string | null;
  total: number;
  paid: number;
  confirmed: number;
  pending: number;
  refunded: number;
  expectedRevenue: number;
  actualRevenue: number;
}

interface EventRow {
  id: string;
  title: string;
  is_open: boolean;
  start_date: string | null;
}

interface FinEntry {
  type: string | null;
  amount: number | null;
  category: string | null;
  event_id: string | null;
}

interface Registration {
  id?: string;
  full_name?: string;
  created_at?: string;
  gender: string | null;
  birth_date: string | null;
  church: string | null;
  perfil_fe: string | null;
  marital_status: string | null;
  is_baptized: boolean | null;
  church_role: string | null;
  payment_status: string | null;
  payment_method: string | null;
  city: string | null;
  event_id?: string;
  checked_in?: boolean;
  paid_amount?: number | null;
  event_lots?: { price: number | null } | null;
  events?: { price: number | null } | null;
  [key: string]: unknown;
}

type MetricKey = 'gender' | 'perfil_fe' | 'marital_status' | 'is_baptized'
  | 'age' | 'church_role' | 'payment_status'
  | 'church' | 'payment_method' | 'city';

interface MetricConfig {
  label: string;
  slot: 1 | 2 | 3;
  type: 'pie' | 'bar' | 'horizontal';
}

const METRICS: Record<MetricKey, MetricConfig> = {
  gender:         { label: 'Gênero',          slot: 1, type: 'pie' },
  perfil_fe:      { label: 'Perfil de Fé',    slot: 1, type: 'pie' },
  marital_status: { label: 'Estado Civil',    slot: 1, type: 'pie' },
  is_baptized:    { label: 'Batizado',        slot: 1, type: 'pie' },
  age:            { label: 'Faixa Etária',    slot: 2, type: 'bar' },
  church_role:    { label: 'Função na Igreja', slot: 2, type: 'bar' },
  payment_status: { label: 'Status Pagamento', slot: 2, type: 'bar' },
  church:         { label: 'Igrejas',         slot: 3, type: 'horizontal' },
  payment_method: { label: 'Forma Pagamento',  slot: 3, type: 'horizontal' },
  city:           { label: 'Cidade',          slot: 3, type: 'horizontal' },
};

const CHART_COLORS = {
  primary: '#f59e0b',
  emerald: '#10b981',
  slate: '#94a3b8',
  rose: '#f43f5e',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
};

const CHURCH_COLORS = ['#f59e0b', '#0ea5e9', '#8b5cf6', '#10b981', '#f43f5e', '#eab308', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6'];
const TOP_N = 5;
const AGE_RANGES = ['0-17', '18-25', '26-35', '36-50', '51+'];
const SLOT1_OPTIONS: MetricKey[] = ['gender', 'perfil_fe', 'marital_status', 'is_baptized'];
const SLOT2_OPTIONS: MetricKey[] = ['age', 'church_role', 'payment_status'];
const SLOT3_OPTIONS: MetricKey[] = ['church', 'payment_method', 'city'];

const PREMIUM_METRICS = new Set<MetricKey>(['perfil_fe', 'marital_status', 'is_baptized', 'church_role', 'payment_status', 'payment_method', 'city']);

export default function DashboardPage() {
  const { event, eventId } = useEvent();
  const { isSuperAdmin, churchId } = useAuth();
  const trial = useTrial();
  const { hasAccess } = useFeatureGate();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [stats, setStats] = useState({ events: 0, registrations: 0 });
  const [eventStats, setEventStats] = useState<EventStat[]>([]);
  const [finStats, setFinStats] = useState({ offerings: 0, expenses: 0 });
  const [showCharts, setShowCharts] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [metric1, setMetric1] = useState<MetricKey>('gender');
  const [metric2, setMetric2] = useState<MetricKey>('age');
  const [metric3, setMetric3] = useState<MetricKey>('church');
  const [activeMetricKeys, setActiveMetricKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      const [eventsCountResult, eventsDataResult, regsDataResult] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*'),
        supabase.from('registrations').select('*, events(price), event_lots!lot_id(price)').neq('payment_status', 'canceled'),
      ]);

      const totalEvents = eventsCountResult.count;
      const eventsData = eventsDataResult.data;
      const regsData = regsDataResult.data;

      const regs = (regsData || []) as unknown as Registration[];
      setRegistrations(regs);

      let filteredRegs = regs;
      if (eventId) {
        filteredRegs = regs.filter((r) => r.event_id === eventId);
      }

      setStats({
        events: totalEvents || 0,
        registrations: filteredRegs.length,
      });

      let fins: FinEntry[] = [];
      try {
        let finQuery = supabase.from('financial_entries').select('type, amount, category, event_id');
        if (eventId) {
          finQuery = finQuery.eq('event_id', eventId);
        }
        const { data, error: finErr } = await finQuery;
        if (!finErr && data) fins = data as FinEntry[];
      } catch (e) {
        console.warn('financial_entries table may not exist yet:', e);
      }

      if (eventsData && regsData) {
        const filteredEvents = eventId
          ? eventsData.filter((ev: EventRow) => ev.id === eventId)
          : eventsData;

        const perEvent = filteredEvents.map((ev: EventRow) => {
          const evRegs = regs.filter((r) => r.event_id === ev.id);
          const paid = evRegs.filter((r) => r.payment_status === 'paid');
          const confirmed = evRegs.filter((r) =>
            r.payment_status === 'paid' || r.payment_status === 'cortesia'
          ).length;
          const pending = evRegs.filter((r) =>
            r.payment_status === 'pending'
          );
          const refundedCount = evRegs.filter((r) => r.payment_status === 'refunded').length;
          const expectedRevenue = evRegs
            .filter((r) => r.payment_status === 'paid' || r.payment_status === 'pending')
            .reduce((acc, r) => acc + Number(r.event_lots?.price ?? r.events?.price ?? 0), 0);
          const actualRevenue = paid
            .reduce((acc: number, r: Registration) => {
              const paidAmt = r.paid_amount != null ? Number(r.paid_amount) : 0;
              if (paidAmt > 0) return acc + paidAmt;
              const lotPrice = r.event_lots?.price;
              const eventPrice = r.events?.price;
              return acc + Number(lotPrice ?? eventPrice ?? 0);
            }, 0);
          return {
            eventId: ev.id,
            title: ev.title,
            is_open: ev.is_open,
            start_date: ev.start_date,
            total: evRegs.length,
            paid: paid.length,
            confirmed,
            pending: pending.length,
            refunded: refundedCount,
            expectedRevenue,
            actualRevenue,
          };
        });
        setEventStats(perEvent);
      }

      setFinStats({
        offerings: fins
          .filter((f: FinEntry) => f.type === 'income' && f.category !== 'registration')
          .reduce((s: number, f: FinEntry) => s + Number(f.amount), 0),
        expenses: fins
          .filter((f: FinEntry) => f.type === 'expense')
          .reduce((s: number, f: FinEntry) => s + Number(f.amount), 0),
      });
      setInitialLoading(false);
    };
    fetch();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const disabled: FormStep[] = [];
    if (event?.step_personal === false) disabled.push('personal');
    if (event?.step_christian_life === false) disabled.push('christian_life');
    if (event?.step_health === false) disabled.push('health');
    if (event?.step_emergency === false) disabled.push('emergency');
    if (event?.step_other === false) disabled.push('other');
    fetchFormFields(eventId, event?.is_custom ?? false, disabled).then((fields) => {
      const keys = fields.map((f) => (f.field_key === 'birth_date' ? 'age' : f.field_key));
      setActiveMetricKeys(new Set(['payment_status', 'payment_method', ...keys]));
    });
  }, [eventId, event?.is_custom, event?.step_personal, event?.step_christian_life, event?.step_health, event?.step_emergency, event?.step_other]);

  const totalPaid = eventStats.reduce((a, b) => a + b.paid, 0);
  const totalConfirmed = eventStats.reduce((a, b) => a + b.confirmed, 0);
  const totalExpected = eventStats.reduce((a, b) => a + b.expectedRevenue, 0);
  const totalActual = eventStats.reduce((a, b) => a + b.actualRevenue, 0);
  const netActual = totalActual;
  const netIncome = netActual + finStats.offerings - finStats.expenses;

  const filteredRegistrations = useMemo(
    () => eventId
      ? registrations.filter((r) => r.event_id === eventId)
      : registrations,
    [registrations, eventId]
  );

  const recentRegistrations = useMemo(() => {
    return [...filteredRegistrations]
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 5);
  }, [filteredRegistrations]);

  // ── helpers ──────────────────────────────────────────────────────────

  const getFieldValue = useCallback((reg: Registration, key: MetricKey): string | boolean | null | undefined => {
    switch (key) {
      case 'gender':         return reg.gender;
      case 'perfil_fe':      return reg.perfil_fe;
      case 'marital_status': return reg.marital_status;
      case 'is_baptized':    return reg.is_baptized;
      case 'age':            return reg.birth_date;
      case 'church_role':    return reg.church_role;
      case 'payment_status': return reg.payment_status;
      case 'payment_method': return reg.payment_method;
      case 'church':         return reg.church;
      case 'city':           return reg.city;
    }
  }, []);

  const normalizeValue = useCallback((key: MetricKey, val: string | boolean | null | undefined): string | null => {
    if (val == null || val === '') return null;
    if (key === 'gender') {
      if (val === 'M') return 'Masculino';
      if (val === 'F') return 'Feminino';
      return String(val);
    }
    if (key === 'is_baptized') return val ? 'Sim' : 'Não';
    if (key === 'payment_status') return paymentStatusLabels[String(val)] || String(val);
    if (key === 'payment_method') return paymentMethodLabels[String(val)] || String(val);
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
    return String(val).trim();
  }, []);

  const computeMetricData = useCallback((key: MetricKey): { name: string; value: number; fill: string }[] => {
    if (key === 'age') return [];

    const counts = new Map<string, number>();
    for (const reg of filteredRegistrations) {
      const raw = getFieldValue(reg, key);
      const normalized = normalizeValue(key, raw);
      if (normalized) {
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }

    if (key === 'is_baptized') {
      if (!counts.has('Sim')) counts.set('Sim', 0);
      if (!counts.has('Não')) counts.set('Não', 0);
    }

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    if (key === 'church' || key === 'city') {
      const top = sorted.slice(0, TOP_N);
      const othersCount = sorted.slice(TOP_N).reduce((s, [, v]) => s + v, 0);
      const result = top.map(([name, value], i) => ({
        name, value,
        fill: CHURCH_COLORS[i % CHURCH_COLORS.length],
      }));
      if (othersCount > 0) {
        result.push({ name: `Outros (${sorted.length - TOP_N})`, value: othersCount, fill: '#9ca3af' });
      }
      return result;
    }

    return sorted.map(([name, value], i) => ({
      name, value,
      fill: CHURCH_COLORS[i % CHURCH_COLORS.length],
    }));
  }, [filteredRegistrations, getFieldValue, normalizeValue]);

  const computeAgeData = useCallback(() => {
    const ranges = [0, 0, 0, 0, 0];
    const today = new Date();
    for (const reg of filteredRegistrations) {
      if (!reg.birth_date) continue;
      const birth = new Date(reg.birth_date);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 0) continue;
      if (age <= 17) ranges[0]++;
      else if (age <= 25) ranges[1]++;
      else if (age <= 35) ranges[2]++;
      else if (age <= 50) ranges[3]++;
      else ranges[4]++;
    }
    return AGE_RANGES.map((label, i) => ({ faixa: label, total: ranges[i] }));
  }, [filteredRegistrations]);

  const metric2AgeData = useMemo(() => computeAgeData(), [computeAgeData]);

  // fallback: se a métrica atual estiver vazia, usa a primeira opção do slot com dados
  const effectiveMetric1 = useMemo(() => {
    if (!hasAccess && PREMIUM_METRICS.has(metric1)) return 'gender';
    if (computeMetricData(metric1).some(d => d.value > 0)) return metric1;

    const firstValid = SLOT1_OPTIONS.find(k =>
      k !== metric1 &&
      activeMetricKeys.has(k) &&
      (!PREMIUM_METRICS.has(k) || hasAccess) &&
      computeMetricData(k).some(d => d.value > 0)
    );
    const defaultMetric = SLOT1_OPTIONS.find(k => activeMetricKeys.has(k) && (!PREMIUM_METRICS.has(k) || hasAccess));

    return firstValid ?? defaultMetric ?? 'gender';
  }, [metric1, computeMetricData, hasAccess, activeMetricKeys]);
  const metric1Data = useMemo(() => computeMetricData(effectiveMetric1), [effectiveMetric1, computeMetricData]);

  const effectiveMetric2 = useMemo(() => {
    if (!hasAccess && PREMIUM_METRICS.has(metric2)) return 'age';
    const hasData = metric2 === 'age'
      ? computeAgeData().some(d => d.total > 0)
      : computeMetricData(metric2).some(d => d.value > 0);
    if (hasData) return metric2;

    const firstValid = SLOT2_OPTIONS.find(k =>
      k !== metric2 &&
      activeMetricKeys.has(k) &&
      (!PREMIUM_METRICS.has(k) || hasAccess) &&
      (k === 'age' ? computeAgeData().some(d => d.total > 0) : computeMetricData(k).some(d => d.value > 0))
    );
    const defaultMetric = SLOT2_OPTIONS.find(k => activeMetricKeys.has(k) && (!PREMIUM_METRICS.has(k) || hasAccess));

    return firstValid ?? defaultMetric ?? 'age';
  }, [metric2, computeMetricData, computeAgeData, hasAccess, activeMetricKeys]);
  const metric2Data = useMemo(() => effectiveMetric2 === 'age' ? [] : computeMetricData(effectiveMetric2), [effectiveMetric2, computeMetricData]);

  const effectiveMetric3 = useMemo(() => {
    if (!hasAccess && PREMIUM_METRICS.has(metric3)) return 'church';
    if (computeMetricData(metric3).some(d => d.value > 0)) return metric3;

    const firstValid = SLOT3_OPTIONS.find(k =>
      k !== metric3 &&
      activeMetricKeys.has(k) &&
      (!PREMIUM_METRICS.has(k) || hasAccess) &&
      computeMetricData(k).some(d => d.value > 0)
    );
    const defaultMetric = SLOT3_OPTIONS.find(k => activeMetricKeys.has(k) && (!PREMIUM_METRICS.has(k) || hasAccess));

    return firstValid ?? defaultMetric ?? 'church';
  }, [metric3, computeMetricData, hasAccess, activeMetricKeys]);
  const metric3Data = useMemo(() => computeMetricData(effectiveMetric3), [effectiveMetric3, computeMetricData]);

  const hasMetric2AgeData = useMemo(() => metric2AgeData.some(d => d.total > 0), [metric2AgeData]);

  // ── render helpers ───────────────────────────────────────────────────

  const renderPieChart = (data: { name: string; value: number; fill: string }[]) => (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={76}
            paddingAngle={4}
            dataKey="value"
            stroke="none"
            {...(!isMobile && {
              label: ({ value = 0, percent = 0 }: { value?: number; percent?: number }) =>
                `${value} (${(percent * 100).toFixed(0)}%)`,
              labelLine: { stroke: 'hsl(215 16% 47%)', strokeWidth: 1 },
            })}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'hsl(222 47% 7%)', border: '1px solid hsl(217 32% 17%)', borderRadius: 8, color: 'hsl(210 40% 98%)' }}
            formatter={(value: number, name: string) => [`${value} inscritos`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-1 flex-wrap">
        {data.map((d) => {
          const total = data.reduce((s, g) => s + g.value, 0);
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : '0';
          return (
            <div key={d.name} className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full" style={{ background: d.fill }} />
              <span className="text-[11px] text-muted-foreground">
                {d.name}: <span className="font-medium text-foreground">{d.value}</span>{' '}
                <span className="text-muted-foreground">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderBarChart = (data: { faixa: string; total: number }[]) => (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: -16 }}>
        <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(222 47% 7%)', border: '1px solid hsl(217 32% 17%)', borderRadius: 8, color: 'hsl(210 40% 98%)' }}
          formatter={(value: number) => [`${value} inscritos`, 'Total']}
          cursor={{ fill: 'hsl(210 40% 96% / 0.3)' }}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} fill={CHART_COLORS.primary}>
          <LabelList
            dataKey="total"
            position="top"
            style={{ fontSize: 10, fill: 'hsl(215 16% 47%)', fontWeight: 600 }}
            formatter={(v: number) => v > 0 ? v : ''}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const renderHorizontalBars = (data: { name: string; value: number; fill: string }[]) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    return (
      <div className="space-y-3">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div key={d.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate">{d.name}</span>
                <span className="font-medium text-foreground ml-2">{d.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: d.fill }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSlotSelector = (slot: 1 | 2 | 3, current: MetricKey, onChange: (k: MetricKey) => void) => (
    <Select
      value={current}
      onValueChange={(v) => {
        if (PREMIUM_METRICS.has(v as MetricKey) && !hasAccess) { setUpgradeOpen(true); return; }
        onChange(v as MetricKey);
      }}
    >
      <SelectTrigger className="text-sm font-medium w-fit gap-1">
        <SelectValue>{METRICS[current]?.label || current}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(METRICS)
          .filter(([key, cfg]) => cfg.slot === slot && activeMetricKeys.has(key as MetricKey))
          .map(([key, cfg]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <span>{cfg.label}</span>
                {PREMIUM_METRICS.has(key as MetricKey) && !hasAccess && (
                  <Lock className="size-3.5 text-amber-500" />
                )}
              </div>
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );

  const renderEmptyMetric = () => (
    <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      Sem dados suficientes para esta métrica
    </div>
  );

  const formatRelativeTime = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';

    const diffInSeconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Agora mesmo';
    if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 172800) return 'Ontem';

    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
  };

  const statusBadgeClass = (status?: string | null) => {
    switch (status) {
      case 'paid':     return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200';
      case 'pending':  return 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200';
      case 'cortesia': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200';
      case 'refunded': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200';
      default:         return 'bg-muted text-muted-foreground';
    }
  };

  const totalInscritos = filteredRegistrations.length;

  if (initialLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" badge={event?.title} />
        <div className="grid grid-cols-2 md:hidden gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/70 animate-pulse" />
          ))}
        </div>
      <div className="grid grid-cols-4 gap-4 md:gap-5 md:grid-cols-5 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
        </div>
      <div className="grid grid-cols-2 gap-4 md:gap-5 md:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
        </div>
        <div className="md:hidden space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonMobileCard key={i} />
          ))}
        </div>
        <div className="hidden md:block">
          <SkeletonTable rows={4} columns={7} />
        </div>
      </div>
    );
  }

  if (isSuperAdmin && !churchId) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="size-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma igreja selecionada</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Use o seletor de igreja no menu lateral para escolher qual igreja visualizar no dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" badge={event?.title} />

      <div className="grid grid-cols-2 md:hidden gap-2 mb-4">
        {trial?.isTrialExceeded ? (
          <button
            onClick={() => trial.openUpgrade()}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Nova Inscrição
          </button>
        ) : (
          <Link
            to={`/app/evento/${eventId}/inscricoes/nova`}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Nova Inscrição
          </Link>
        )}
        {trial?.isTrialExceeded ? (
          <button
            onClick={() => trial.openUpgrade()}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Gerar Convite
          </button>
        ) : (
          <Link
            to={`/app/evento/${eventId}/convites`}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Gerar Convite
          </Link>
        )}
        <Link
          to={`/app/evento/${eventId}/financeiro`}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          Lançar Entrada
        </Link>
        <Link
          to={`/app/evento/${eventId}/inscricoes`}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          Check-in
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 mb-6">
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0 min-h-[100px]">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Inscrições</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold text-foreground">{stats.registrations}</p>
          </CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Confirmados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold text-violet-400">{totalConfirmed}</p>
          </CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold text-primary">{totalPaid}</p>
          </CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold text-muted-foreground">{eventStats.reduce((a, b) => a + b.pending, 0)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0 min-h-[100px]">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Reembolsados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold text-orange-400">{eventStats.reduce((a, b) => a + b.refunded, 0)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0 min-h-[100px]">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Previsto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold truncate text-blue-400">{formatCurrency(totalExpected)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1 bg-card backdrop-blur-md border-border shadow-lg min-w-0">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Real</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold truncate text-emerald-400">{formatCurrency(netActual)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4 mb-6">
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0 min-h-[100px]">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Ofertas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold truncate text-emerald-400">{formatCurrency(finStats.offerings)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold truncate text-red-400">{formatCurrency(finStats.expenses)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Total Entradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl md:text-3xl font-bold truncate text-foreground">{formatCurrency(netActual + finStats.offerings)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card backdrop-blur-md border-border shadow-lg min-w-0">
          <CardHeader className="pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm text-muted-foreground">Saldo Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`font-serif text-xl md:text-3xl font-bold truncate ${netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(netIncome)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mobile: toggle gráficos */}
      <div className="md:hidden mb-4">
        <Button
          variant="outline"
          className="w-full max-md:h-11 md:h-10"
          onClick={() => setShowCharts(!showCharts)}
        >
          {showCharts ? 'Ocultar gráficos' : 'Ver gráficos'}
        </Button>
      </div>

      {(showCharts || !isMobile) && eventId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* ─── Slot 1 – Pie ─── */}
          <Card className="bg-card backdrop-blur-md border-border shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                {renderSlotSelector(1, effectiveMetric1, setMetric1)}
                <span className="text-xs text-muted-foreground">{totalInscritos} inscritos</span>
              </div>
            </CardHeader>
            <CardContent>
              {metric1Data.some(d => d.value > 0) ? renderPieChart(metric1Data) : renderEmptyMetric()}
            </CardContent>
          </Card>

          {/* ─── Slot 2 – Bar / Age ─── */}
          <Card className="bg-card backdrop-blur-md border-border shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                {renderSlotSelector(2, effectiveMetric2, setMetric2)}
                <span className="text-xs text-muted-foreground">{totalInscritos} inscritos</span>
              </div>
            </CardHeader>
            <CardContent>
              {effectiveMetric2 === 'age'
                ? (hasMetric2AgeData ? renderBarChart(metric2AgeData) : renderEmptyMetric())
                : (metric2Data.some(d => d.value > 0) ? renderPieChart(metric2Data) : renderEmptyMetric())
              }
            </CardContent>
          </Card>

          {/* ─── Slot 3 – Horizontal bars ─── */}
          <Card className="bg-card backdrop-blur-md border-border shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                {renderSlotSelector(3, effectiveMetric3, setMetric3)}
                <span className="text-xs text-muted-foreground">{totalInscritos} inscritos</span>
              </div>
            </CardHeader>
            <CardContent>
              {metric3Data.some(d => d.value > 0) ? renderHorizontalBars(metric3Data) : renderEmptyMetric()}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-6 bg-card backdrop-blur-xl border-border shadow-2xl">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Últimas Inscrições</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRegistrations.length === 0 ? (
            <EmptyState title="Nenhuma inscrição recente" description="As inscrições aparecerão aqui assim que os participantes se registrarem." />
          ) : (
            <>
              {/* Mobile: lista */}
              <div className="space-y-3 md:hidden">
                {recentRegistrations.map((reg) => (
                  <div key={reg.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground truncate">{reg.full_name ?? (reg.name as string | undefined) ?? '—'}</p>
                      <Badge
                        variant="secondary"
                        className={statusBadgeClass(reg.payment_status)}
                      >
                        {paymentStatusLabels[String(reg.payment_status ?? '')] ?? reg.payment_status ?? '—'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(reg.created_at)}</span>
                      <span className="font-medium text-foreground">{formatCurrency(Number(reg.paid_amount ?? reg.event_lots?.price ?? reg.events?.price ?? 0))}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: tabela */}
              <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-accent">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Inscrito</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Data da Inscrição</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status do Pagamento</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRegistrations.map((reg) => (
                      <tr key={reg.id} className="border-b border-border hover:bg-accent">
                        <td className="p-4 text-base font-medium text-foreground">{reg.full_name ?? (reg.name as string | undefined) ?? '—'}</td>
                        <td className="p-4 text-sm text-muted-foreground">{formatRelativeTime(reg.created_at)}</td>
                        <td className="p-4 text-base">
                          <Badge
                            variant="secondary"
                            className={statusBadgeClass(reg.payment_status)}
                          >
                            {paymentStatusLabels[String(reg.payment_status ?? '')] ?? reg.payment_status ?? '—'}
                          </Badge>
                        </td>
                        <td className="p-4 text-base">{formatCurrency(Number(reg.paid_amount ?? reg.event_lots?.price ?? reg.events?.price ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <Link
                  to={`/app/evento/${eventId}/inscricoes`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Ver todas as inscrições
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        featureName="Métricas Avançadas"
      />
    </div>
  );
}
