import { supabase } from "./supabaseClient";
import type { HistorySession, PR } from "./types";

// Load finished-session history for a set of routine_exercise ids,
// excluding the current workout. Returns a map keyed by routine_exercise_id,
// each value a list of sessions sorted most recent first.
export async function loadHistory(
  routineExerciseIds: string[],
  excludeWorkoutId: string | null
): Promise<Map<string, HistorySession[]>> {
  const map = new Map<string, HistorySession[]>();
  if (!routineExerciseIds.length) return map;

  const { data, error } = await supabase
    .from("workout_exercises")
    .select(
      "id, routine_exercise_id, workout_id, workouts!inner(id, started_at, finished_at), sets(set_index, weight, reps, completed_at)"
    )
    .in("routine_exercise_id", routineExerciseIds);

  if (error || !data) return map;

  for (const row of data as any[]) {
    const w = row.workouts;
    if (!w || !w.finished_at) continue;
    if (excludeWorkoutId && row.workout_id === excludeWorkoutId) continue;
    const rexId = row.routine_exercise_id as string;
    const sets = ((row.sets || []) as any[])
      .filter((s) => s.weight != null && s.reps != null)
      .sort((a, b) => a.set_index - b.set_index)
      .map((s) => ({ set_index: s.set_index, weight: Number(s.weight), reps: Number(s.reps) }));
    if (!sets.length) continue;
    if (!map.has(rexId)) map.set(rexId, []);
    map.get(rexId)!.push({ workout_id: row.workout_id, started_at: w.started_at, sets });
  }

  for (const sessions of map.values()) {
    sessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }
  return map;
}

// PR = highest weight; at that weight, the highest reps. Per set index.
export function computePRs(sessions: HistorySession[]): Map<number, PR> {
  const prs = new Map<number, PR>();
  for (const sess of sessions) {
    for (const s of sess.sets) {
      const cur = prs.get(s.set_index);
      if (!cur || s.weight > cur.weight || (s.weight === cur.weight && s.reps > cur.reps)) {
        prs.set(s.set_index, { weight: s.weight, reps: s.reps });
      }
    }
  }
  return prs;
}

// Overall exercise PR across all set indexes.
export function overallPR(sessions: HistorySession[]): PR | null {
  let best: PR | null = null;
  for (const sess of sessions) {
    for (const s of sess.sets) {
      if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) {
        best = { weight: s.weight, reps: s.reps };
      }
    }
  }
  return best;
}

// The best set within a single session (highest weight, ties broken by reps).
// Same definition of "best" the app uses everywhere else.
function bestSetOf(sess: HistorySession): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null;
  for (const s of sess.sets) {
    if (s.weight == null || s.reps == null) continue;
    if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) {
      best = { weight: s.weight, reps: s.reps };
    }
  }
  return best;
}

const betterThan = (
  a: { weight: number; reps: number },
  b: { weight: number; reps: number }
) => a.weight > b.weight || (a.weight === b.weight && a.reps > b.reps);

export type Mover = {
  routineExerciseId: string;
  name: string; // "Routine · Exercise"
  exerciseName: string;
  current: { weight: number; reps: number };
  status: "stalled" | "progressing";
  // stalled:
  sessionsStalled?: number; // sessions since the last improvement
  lastGain?: string; // ISO date of the last time it improved
  // progressing:
  prev?: { weight: number; reps: number }; // the peak before the current one
  lbPerMonth?: number; // rough rate of weight gain
};

// Classify every exercise as stalled or progressing based on best-set-per-session.
// Needs at least `minSessions` sessions of a lift before it says anything.
export function computeMovers(
  histories: { routineExerciseId: string; name: string; exerciseName: string; sessions: HistorySession[] }[],
  opts: { stallThreshold?: number; minSessions?: number } = {}
): { stalled: Mover[]; progressing: Mover[] } {
  const stallThreshold = opts.stallThreshold ?? 3;
  const minSessions = opts.minSessions ?? 3;
  const stalled: Mover[] = [];
  const progressing: Mover[] = [];

  for (const h of histories) {
    // oldest -> newest, only sessions that actually had a logged set
    const ordered = [...h.sessions]
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
      .map((s) => ({ session: s, best: bestSetOf(s) }))
      .filter((x) => x.best !== null) as {
      session: HistorySession;
      best: { weight: number; reps: number };
    }[];

    if (ordered.length < minSessions) continue;

    const current = ordered[ordered.length - 1].best;

    // walk backward to find the running peak and when it was last beaten
    let peak = ordered[0].best;
    let lastGainIdx = 0;
    for (let i = 1; i < ordered.length; i++) {
      if (betterThan(ordered[i].best, peak)) {
        peak = ordered[i].best;
        lastGainIdx = i;
      }
    }

    const sessionsSinceGain = ordered.length - 1 - lastGainIdx;

    if (sessionsSinceGain >= stallThreshold) {
      stalled.push({
        routineExerciseId: h.routineExerciseId,
        name: h.name,
        exerciseName: h.exerciseName,
        current,
        status: "stalled",
        sessionsStalled: sessionsSinceGain,
        lastGain: ordered[lastGainIdx].session.started_at,
      });
    } else {
      // progressing: compare current peak to the peak before it
      let prevPeak: { weight: number; reps: number } | null = null;
      for (let i = 0; i < lastGainIdx; i++) {
        if (!prevPeak || betterThan(ordered[i].best, prevPeak)) prevPeak = ordered[i].best;
      }
      const firstDate = new Date(ordered[0].session.started_at).getTime();
      const lastDate = new Date(ordered[ordered.length - 1].session.started_at).getTime();
      const months = Math.max((lastDate - firstDate) / (1000 * 60 * 60 * 24 * 30), 0.25);
      const lbGain = current.weight - ordered[0].best.weight;
      progressing.push({
        routineExerciseId: h.routineExerciseId,
        name: h.name,
        exerciseName: h.exerciseName,
        current,
        status: "progressing",
        prev: prevPeak ?? undefined,
        lbPerMonth: lbGain > 0 ? lbGain / months : 0,
      });
    }
  }

  // worst stalls first (most sessions stuck), best movers first (fastest gain)
  stalled.sort((a, b) => (b.sessionsStalled ?? 0) - (a.sessionsStalled ?? 0));
  progressing.sort((a, b) => (b.lbPerMonth ?? 0) - (a.lbPerMonth ?? 0));
  return { stalled, progressing };
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function fmtDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins} min`;
}

// Session duration = first logged set to last logged set.
// Sets are timestamped when you enter reps, so this works whether or not you
// remembered to hit Finish. We deliberately do NOT fall back to
// finishedAt - startedAt, because a workout left open for hours produces a
// garbage number (that is where the 1800-minute sessions came from).
export function sessionDurationMs(
  startedAt: string,
  finishedAt: string | null,
  completedTimes: string[]
): number {
  if (completedTimes.length >= 2) {
    const times = completedTimes.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
    return times[times.length - 1] - times[0];
  }
  // A single logged set means we have no span to measure.
  // A workout with no timestamps at all is treated the same way.
  return 0;
}
