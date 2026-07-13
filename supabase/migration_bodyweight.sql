-- Bodyweight gets its own table so you can log it on rest days too,
-- not only on days you happen to train.
-- Run this in the Supabase SQL Editor.

create table if not exists bodyweight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  entry_date date not null,
  weight numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists idx_bw_user_date
  on bodyweight_entries(user_id, entry_date desc);

alter table bodyweight_entries enable row level security;

create policy "own bodyweight" on bodyweight_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bring across any bodyweight already logged inside workouts, so nothing is lost.
-- If two workouts on the same day both have a weight, the later one wins.
insert into bodyweight_entries (user_id, entry_date, weight)
select distinct on (user_id, started_at::date)
  user_id,
  started_at::date,
  bodyweight
from workouts
where bodyweight is not null
order by user_id, started_at::date, started_at desc
on conflict (user_id, entry_date) do nothing;
