-- Remove duplicate default fields (event_id IS NULL) with same field_key
-- PostgreSQL's UNIQUE (event_id, field_key) treats NULLs as distinct,
-- so duplicates can accumulate when the same field is inserted twice.
DELETE FROM event_form_fields
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY field_key ORDER BY created_at) AS rn
    FROM event_form_fields WHERE event_id IS NULL
  ) dup WHERE dup.rn > 1
);
