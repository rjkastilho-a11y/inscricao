export type PlanType = 'monthly' | 'annual';

export type ChurchStatus = 'trial' | 'active' | 'suspended';

export interface Church {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  status: ChurchStatus | string;
  trial_ends_at: string | null;
  trial_suspended_at: string | null;
  plan_type: PlanType;
  is_vip: boolean;
}
