# RepCount

Progressive overload tracker. Next.js + Supabase + TypeScript, same stack as Arete. Deploys to Vercel and runs great on a phone browser (add to home screen for an app-like feel).

## Features

- Routines you build yourself. The same exercise in two different routines tracks completely separately, so bench first in Push A and bench last in Push B keep independent history and PRs.
- Active workout logging: each set gets weight + reps, greyed reference showing last session's numbers, and your PR for that exact set shown inline. PR = highest weight, tiebroken by most reps at that weight.
- Rest timer that auto-starts when you mark a set done, counts down from your setting (default 3:00), says Rest over, and is skippable.
- Session duration tracked from first completed set to last.
- One persistent note per exercise per routine (e.g. "bench 45 degrees") that shows up every session.
- Plate calculator: tap plates, it sums them plus bar weight.
- Log grouped by month, Statistics (volume, sets, reps, durations, bodyweight chart, per-exercise trend + per-set PRs).
- Seeded exercise library grouped by muscle, plus custom exercises.

## Setup (about 10 minutes)

### 1. Supabase

1. Go to supabase.com, create a new project (free tier is fine).
2. In the project, open SQL Editor, paste the entire contents of `supabase/schema.sql`, and run it.
3. Go to Authentication > Providers and make sure Email is enabled. Optional: under Authentication > Settings, turn off "Confirm email" so you can sign in immediately without an email verification step.
4. Go to Project Settings > API and copy the Project URL and the anon public key.

### 2. Run locally (optional)

```bash
npm install
cp .env.local.example .env.local
# paste your Supabase URL and anon key into .env.local
npm run dev
```

### 3. Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. In Vercel, click Add New > Project, import the repo. Next.js is auto-detected.
3. Under Environment Variables add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
4. Deploy. Open the URL on your phone, sign up with email + password, and add it to your home screen (Share > Add to Home Screen on iOS).

## Notes

- All data is per-account and protected with Supabase row level security.
- Deleting a routine keeps past workouts in your Log.
- Sets left completely empty when you hit Finish are cleaned up automatically so history stays accurate.
