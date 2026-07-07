-- Fix db_column for date fields (birth_date) that have NULL db_column
-- This ensures the RegistrationDetailPage can find and display the field

UPDATE event_form_fields 
SET db_column = 'birth_date' 
WHERE field_key = 'data-nascimento' 
  AND (db_column IS NULL OR db_column != 'birth_date');
