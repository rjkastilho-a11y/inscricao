import { createContext, useContext } from 'react';

export interface EventData {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  hotsite_title?: string | null;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  location_name: string | null;
  show_location: boolean;
  show_about?: boolean;
  show_registration?: boolean;
  is_open: boolean;
  is_custom: boolean;
  max_capacity: number;
  price: number;
  cover_url: string;
  watermark_url: string | null;
  terms_text: string | null;
  terms_enabled: boolean;
  step_personal: boolean;
  step_christian_life: boolean;
  step_health: boolean;
  step_emergency: boolean;
  step_other: boolean;
  payment_link: string | null;
  created_at: string;
}

export interface EventContextValue {
  event: EventData | null;
  eventId: string | null;
  loading: boolean;
  error: string | null;
  refreshEvent: () => Promise<void>;
}

export const EventContext = createContext<EventContextValue>({
  event: null,
  eventId: null,
  loading: true,
  error: null,
  refreshEvent: async () => {},
});

export function useEvent() {
  return useContext(EventContext);
}
