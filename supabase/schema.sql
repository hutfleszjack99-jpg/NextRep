-- RepCount schema. Paste this whole file into the Supabase SQL Editor and run it once.

create table if not exists user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  rest_seconds int not null default 180,
  rest_enabled boolean not null default true,
  rest_sound_enabled boolean not null default false,
  bar_weight numeric not null default 45
);

create table if not exists custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  muscle_group text not null default 'Other',
  created_at timestamptz not null default now()
);

create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  routine_id uuid not null references routines on delete cascade,
  exercise_name text not null,
  position int not null default 0,
  note text not null default '',
  default_sets int not null default 3
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  routine_id uuid references routines on delete set null,
  routine_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  bodyweight numeric
);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  workout_id uuid not null references workouts on delete cascade,
  routine_exercise_id uuid references routine_exercises on delete set null,
  exercise_name text not null,
  position int not null default 0
);

create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  workout_exercise_id uuid not null references workout_exercises on delete cascade,
  set_index int not null,
  weight numeric,
  reps numeric,
  completed_at timestamptz
);

create index if not exists idx_sets_wex on sets(workout_exercise_id);
create index if not exists idx_wex_workout on workout_exercises(workout_id);
create index if not exists idx_wex_rex on workout_exercises(routine_exercise_id);
create index if not exists idx_workouts_user on workouts(user_id, started_at desc);

-- Row level security: each user only sees their own rows.
alter table user_settings enable row level security;
alter table custom_exercises enable row level security;
alter table routines enable row level security;
alter table routine_exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table sets enable row level security;

create policy "own settings" on user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own custom exercises" on custom_exercises for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routines" on routines for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routine exercises" on routine_exercises for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workouts" on workouts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workout exercises" on workout_exercises for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sets" on sets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
