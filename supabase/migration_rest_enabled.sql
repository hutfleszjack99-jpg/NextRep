-- Run this in the Supabase SQL Editor if you already ran the original schema.
-- It adds the rest-timer on/off setting and enables decimal reps without touching your data.

alter table user_settings
  add column if not exists rest_enabled boolean not null default true;

alter table sets
  alter column reps type numeric;
