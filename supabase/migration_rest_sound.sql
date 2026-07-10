-- Run this in the Supabase SQL Editor to add the rest-timer sound setting.

alter table user_settings
  add column if not exists rest_sound_enabled boolean not null default false;
