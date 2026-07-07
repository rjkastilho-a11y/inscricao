ALTER TABLE registrations ADD COLUMN IF NOT EXISTS extra_data jsonb DEFAULT NULL;
