-- Define db_column for default fields based on field_key
UPDATE event_form_fields SET db_column = 'full_name' WHERE field_key = 'full_name' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'email' WHERE field_key = 'email' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'whatsapp' WHERE field_key = 'whatsapp' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'birth_date' WHERE field_key = 'birth_date' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'gender' WHERE field_key = 'gender' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'is_christian' WHERE field_key = 'is_christian' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'is_baptized' WHERE field_key = 'is_baptized' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'church' WHERE field_key = 'church' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'pastor' WHERE field_key = 'pastor' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'church_role' WHERE field_key = 'church_role' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'church_role_other' WHERE field_key = 'church_role_other' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'godparent' WHERE field_key = 'godparent' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'godparent_contact' WHERE field_key = 'godparent_contact' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'pastoral_authorization' WHERE field_key = 'pastoral_authorization' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'health_info' WHERE field_key = 'health_info' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'emergency_contact' WHERE field_key = 'emergency_contact' AND db_column IS NULL;
UPDATE event_form_fields SET db_column = 'emergency_phone' WHERE field_key = 'emergency_phone' AND db_column IS NULL;
