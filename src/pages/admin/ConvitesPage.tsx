import { useEvent } from '@/contexts/EventContext';
import GestaoConvites from '@/components/GestaoConvites';

export default function ConvitesPage() {
  const { event } = useEvent();
  if (!event) return null;
  return (
    <GestaoConvites
      eventId={event.id}
      eventSlug={event.slug}
      eventTitle={event.title}
      eventIsOpen={event.is_open}
    />
  );
}
