import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export interface EventData {
  id: string;
  slug: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  is_open: boolean;
  is_custom: boolean;
  max_capacity: number;
  price: number;
  cover_url: string;
  watermark_url: string | null;
  terms_text: string | null;
  terms_enabled: boolean;
  created_at: string;
}

interface EventContextValue {
  event: EventData | null;
  eventId: string | null;
  loading: boolean;
  error: string | null;
}

const EventContext = createContext<EventContextValue>({
  event: null,
  eventId: null,
  loading: true,
  error: null,
});

export function EventProvider({ children }: { children: ReactNode }) {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setEvent(null);
        } else {
          setEvent(data as EventData);
          setError(null);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [eventId]);

  return (
    <EventContext.Provider value={{ event, eventId: eventId ?? null, loading, error }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  return useContext(EventContext);
}
