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

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function fmtDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  return `${mins} min`;
}

// Session duration: first completed set to last completed set,
// falling back to started/finished timestamps.
export function sessionDurationMs(
  startedAt: string,
  finishedAt: string | null,
  completedTimes: string[]
): number {
  if (completedTimes.length >= 2) {
    const times = completedTimes.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
    return times[times.length - 1] - times[0];
  }
  if (finishedAt) return new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return 0;
}
