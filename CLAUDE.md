# NextRep

A progressive-overload workout tracker. Log workouts set by set, see your last-session numbers and per-set PRs while you lift, and track progress over time. Built to run as a phone web app (added to the home screen).

## Stack

- Next.js 14 (App Router), TypeScript, React 18
- Supabase (Postgres + Auth, email/password) with Row Level Security
- Tailwind CSS
- recharts for charts, @dnd-kit for drag-to-reorder
- Deployed on Vercel (auto-redeploys on push to `main`)

Same stack as the Arete app.

## How to deploy a change

1. Edit the files.
2. Commit and push to `main`. Vercel redeploys automatically within about a minute.
3. If the change touches the database (new column, changed column type), also run the matching SQL in the Supabase SQL Editor. Migration files live in `supabase/`. Code that reads a new column will error until the migration is run.

Environment variables (set in Vercel and in `.env.local` for local dev):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (this is the Supabase *publishable* key)

## File layout

- `app/log/page.tsx` — Log tab: past workouts grouped by month, swipe to delete, tap to open detail. Also surfaces any in-progress (unfinished) workout with a Resume button.
- `app/log/[id]/page.tsx` — read-only + editable detail for one past workout (edit weight, reps, add/remove sets, bodyweight).
- `app/routines/page.tsx` — Routines tab: list of user-built routines, create/rename/delete.
- `app/routines/[id]/page.tsx` — routine detail: start a workout, add exercises, drag to reorder (⠿ handle), set default set count per exercise.
- `app/workout/[id]/page.tsx` — the active workout screen. The most important and most complex file. Set logging, inline per-set PRs, rest timer, plate calculator, finish/discard.
- `app/stats/page.tsx` — Statistics tab: overall totals, bodyweight chart, per-exercise trend + per-set PRs.
- `app/profile/page.tsx` — Profile tab: rest timer on/off + duration, bar weight, sign out.
- `components/` — `Shell` (auth gate + bottom nav wrapper), `BottomNav`, `AuthGate`, `ExercisePicker`, `PlateCalculator`, `RestTimerBar`, `SwipeToDelete`.
- `lib/` — `supabaseClient.ts`, `types.ts`, `data.ts` (history loading, PR computation, duration/format helpers), `exercises.ts` (seeded exercise library).
- `supabase/schema.sql` — full schema, run once on a fresh project. `supabase/migration_*.sql` — incremental migrations for existing databases.

## Core domain rules (important, easy to get wrong)

- **A set counts as "logged" if it has both weight and reps filled in.** Do NOT require `completed_at` (the green checkmark) for history, PRs, the Log, or Statistics. The checkmark is optional and does not gate anything. This bug has been reintroduced several times, be careful when writing any query or filter over sets.
- **PRs are keyed per routine, not globally per exercise.** History and PRs are matched by `routine_exercise_id`. Bench as the first exercise in "Push A" tracks completely separately from bench in "Push B". Never merge an exercise's data across routines.
- **PR definition:** highest weight; ties broken by most reps at that weight. Not estimated 1RM, not volume. See `computePRs` in `lib/data.ts`.
- **Rest timer** starts when reps are entered for a set (not on the checkmark), and only if a next set exists in that exercise. It renders inline as a bar under the next set, counts down from the user's setting, and turns green ("Ready") at zero. It respects the on/off toggle in Profile. It persists to `sessionStorage` (keyed `restTimer:{workoutId}`) so it survives leaving the page; restore ignores anything older than 10 minutes; clear it on finish and discard.
- **Weight and reps both accept decimals** (e.g. 2.5 lb, 8.5 reps). Inputs keep raw text while typing (so a trailing "." survives) and parse to a number on blur. The `sets.reps` and `sets.weight` columns are `numeric`.
- **Bar weight** may be 0 (for machines/dumbbells). The plate calculator sums plates plus bar weight.
- **Starting a routine** pre-creates the workout's sets, matching the set count from the last time that routine was done (or the routine's default_sets on first run), and shows last-session numbers as grey placeholders.

## Data model (Supabase tables)

- `user_settings` — rest_seconds, rest_enabled, bar_weight, per user.
- `custom_exercises` — user-created exercises beyond the seeded library.
- `routines` — user's routines.
- `routine_exercises` — exercises in a routine, with position, note (persists across sessions), default_sets.
- `workouts` — a dated session; has routine_name, started_at, finished_at, bodyweight.
- `workout_exercises` — exercises in a specific workout, linked back to routine_exercise_id.
- `sets` — set_index, weight, reps, completed_at, under a workout_exercise.

All tables have RLS policies restricting rows to `auth.uid() = user_id`. New tables need matching policies or all reads/writes silently fail.

## Conventions

- Writing style in all copy, comments, and UI text: no em-dashes. Direct and conversational.
- Colors are Tailwind theme tokens: `bg`, `card`, `line`, `dim`, `accent` (cyan), `accent2` (green), `danger`. Dark theme only.
- Prefer optimistic UI updates backed by a Supabase write; surface errors with an alert rather than failing silently (silent failures have caused hard-to-diagnose bugs here).
- Client components only (`"use client"` at top); data is fetched client-side via the supabase browser client.
