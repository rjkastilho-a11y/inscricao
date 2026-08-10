import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { EventContext, type EventData } from '@/contexts/useEvent';

export function EventProvider({ children }: { children: ReactNode }) {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prevEventId, setPrevEventId] = useState<string | null>(eventId ?? null);
  if (eventId !== prevEventId) {
    setPrevEventId(eventId ?? null);
    setEvent(null);
    setError(null);
    setLoading(eventId != null);
  }

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;

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

  const refreshEvent = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();
    if (data) setEvent(data as EventData);
  }, [eventId]);

  return (
    <EventContext.Provider value={{ event, eventId: eventId ?? null, loading, error, refreshEvent }}>
      {children}
    </EventContext.Provider>
  );
}
