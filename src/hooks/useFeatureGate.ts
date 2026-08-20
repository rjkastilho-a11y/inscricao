import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Church, PlanType } from '@/types/database';

export type FeatureName =
  | 'advanced_analytics'
  | 'custom_forms'
  | 'bulk_import'
  | 'date_range_filters'
  | 'finance_export'
  | 'cross_event_reports'
  | 'custom_groups'
  | 'labels_badges'
  | 'bulk_delete'
  | 'group_pdf'
  | 'attendance_sheets';

const PREMIUM_FEATURES = new Set<FeatureName>([
  'advanced_analytics',
  'custom_forms',
  'bulk_import',
  'date_range_filters',
  'finance_export',
  'cross_event_reports',
  'custom_groups',
  'labels_badges',
  'bulk_delete',
  'group_pdf',
  'attendance_sheets',
]);

export const TRIAL_REG_LIMIT = 50;

export function useFeatureGate(feature?: FeatureName) {
  const { user, isSuperAdmin, churchId } = useAuth();

  const { data: church, isLoading: churchLoading } = useQuery<Church | null>({
    queryKey: ['church', churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error } = await supabase
        .from('churches')
        .select('id, name, status, trial_ends_at, trial_suspended_at, is_active, plan_type, is_vip')
        .eq('id', churchId)
        .maybeSingle();

      if (error) {
        console.error('[useFeatureGate] Erro ao carregar igreja:', error.message);
        return null;
      }
      return (data as Church) || null;
    },
    enabled: !!churchId && !!user && !isSuperAdmin,
    staleTime: 60_000,
  });

  const isPotentialTrial =
    church?.status === 'trial' &&
    church?.is_active &&
    church?.is_vip !== true &&
    church?.plan_type !== 'annual';

  const { data: trialRegCount, isLoading: trialCountLoading } = useQuery<number>({
    queryKey: ['trialRegCount', churchId],
    queryFn: async () => {
      if (!churchId) return 0;
      const { count } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('church_id', churchId)
        .is('deleted_at', null);
      return count ?? 0;
    },
    enabled: !!churchId && !!isPotentialTrial && !isSuperAdmin,
    staleTime: 60_000,
  });

  const isActive = church?.is_active ?? (church?.status === 'active');
  const planUnlocked = (church?.is_vip === true || church?.plan_type === 'annual') && isActive;

  let isTrialActive = false;
  if (isPotentialTrial && !planUnlocked) {
    const daysRemaining = church?.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(church.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    const withinTimeLimit = daysRemaining === null || daysRemaining > 0;
    const withinRegLimit = (trialRegCount ?? 0) < TRIAL_REG_LIMIT;
    isTrialActive = withinTimeLimit && withinRegLimit;
  }

  const baseAccess = isSuperAdmin || planUnlocked || isTrialActive;
  const hasAccess = feature ? (PREMIUM_FEATURES.has(feature) ? baseAccess : true) : baseAccess;

  console.log('[useFeatureGate]', { isTrialActive, baseAccess, hasAccess, planUnlocked, isSuperAdmin });

  return {
    isVip: church?.is_vip ?? false,
    planType: (church?.plan_type ?? 'monthly') as PlanType,
    status: church?.status ?? null,
    isLoading: churchLoading || (isPotentialTrial && trialCountLoading),
    planUnlocked,
    isTrialActive,
    hasAccess,
  };
}
