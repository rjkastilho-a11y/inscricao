DROP POLICY IF EXISTS "Public can view active form fields" ON public.event_form_fields;

DROP POLICY IF EXISTS "fields_anon_read" ON public.event_form_fields;

CREATE POLICY "fields_anon_read" ON public.event_form_fields
  FOR SELECT
  TO anon
  USING (
    event_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.is_open = true
    )
  );
