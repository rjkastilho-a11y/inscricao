-- Add paid_amount column to registrations table
ALTER TABLE public.registrations
ADD COLUMN paid_amount DECIMAL(10,2);
