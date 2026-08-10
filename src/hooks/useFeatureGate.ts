import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Church, PlanType } from '@/types/database';

export function useFeatureGate() {
  const { user, isSuperAdmin, churchId } = useAuth();

  const { data: church, isLoading } = useQuery<Church | null>({
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
    // CORREÇÃO CRÍTICA 2: Removido o 'isAdmin' para permitir que operadores herdem o plano da igreja
    enabled: !!churchId && !!user && !isSuperAdmin,
    staleTime: 60_000,
  });

  // CORREÇÃO CRÍTICA 1: O plano precisa ser VIP/Anual E a igreja precisa estar com status ativo
  const isActive = church?.is_active ?? (church?.status === 'active');
  const planUnlocked = (church?.is_vip === true || church?.plan_type === 'annual') && isActive;

  // Fonte Única da Verdade (SSOT) consolidada
  const hasAccess = isSuperAdmin || planUnlocked;

  return {
    isVip: church?.is_vip ?? false,
    planType: (church?.plan_type ?? 'monthly') as PlanType,
    status: church?.status ?? null,
    isLoading,
    planUnlocked,
    hasAccess,
  };
}
