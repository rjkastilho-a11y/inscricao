ALTER TABLE events ADD COLUMN IF NOT EXISTS step_other BOOLEAN DEFAULT true;

ALTER TABLE event_form_fields DROP CONSTRAINT IF EXISTS event_form_fields_step_check;
ALTER TABLE event_form_fields ADD CONSTRAINT event_form_fields_step_check
  CHECK (step IN ('personal', 'christian_life', 'health', 'emergency', 'other'));
