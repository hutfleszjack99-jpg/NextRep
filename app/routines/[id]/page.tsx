"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import ExercisePicker from "@/components/ExercisePicker";
import { supabase } from "@/lib/supabaseClient";
import type { Routine, RoutineExercise } from "@/lib/types";

export default function RoutineDetailPage() {
  return (
    <Shell>
      <RoutineDetail />
    </Shell>
  );
}

function RoutineDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    const { data: r } = await supabase.from("routines").select("*").eq("id", params.id).single();
    setRoutine(r as Routine);
    setName((r as any)?.name || "");
    const { data: ex } = await supabase
      .from("routine_exercises")
      .select("*")
      .eq("routine_id", params.id)
      .order("position", { ascending: true });
    setExercises((ex as RoutineExercise[]) || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [params.id]);

  const addExercise = async (exerciseName: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid || !routine) return;
    await supabase.from("routine_exercises").insert({
      user_id: uid,
      routine_id: routine.id,
      exercise_name: exerciseName,
      position: exercises.length,
    });
    setPicking(false);
    load();
  };

  const removeExercise = async (rex: RoutineExercise) => {
    if (!confirm(`Remove ${rex.exercise_name} from this routine? Its history stays saved.`)) return;
    await supabase.from("routine_exercises").delete().eq("id", rex.id);
    load();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const other = idx + dir;
    if (other < 0 || other >= exercises.length) return;
    const a = exercises[idx];
    const b = exercises[other];
    await supabase.from("routine_exercises").update({ position: other }).eq("id", a.id);
    await supabase.from("routine_exercises").update({ position: idx }).eq("id", b.id);
    load();
  };

  const saveName = async () => {
    if (!routine) return;
    const n = name.trim();
    if (n && n !== routine.name) {
      await supabase.from("routines").update({ name: n }).eq("id", routine.id);
    }
    setRenaming(false);
    load();
  };

  // Start a workout: create workout + workout_exercises + pre-created sets
  // matching last session's set count (or default_sets on first run).
  const startWorkout = async () => {
    if (!routine || starting) return;
    if (!exercises.length) {
      alert("Add at least one exercise first.");
      return;
    }
    setStarting(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;

    const { data: w, error } = await supabase
      .from("workouts")
      .insert({ user_id: uid, routine_id: routine.id, routine_name: routine.name })
      .select()
      .single();
    if (error || !w) {
      setStarting(false);
      alert("Could not start workout: " + (error?.message || "unknown error"));
      return;
    }

    // find last set counts per routine exercise
    const rexIds = exercises.map((e) => e.id);
    const { data: hist } = await supabase
      .from("workout_exercises")
      .select("routine_exercise_id, workout_id, workouts!inner(started_at, finished_at), sets(set_index)")
      .in("routine_exercise_id", rexIds);

    const lastCounts = new Map<string, number>();
    const lastDates = new Map<string, number>();
    for (const row of (hist as any[]) || []) {
      if (!row.workouts?.finished_at) continue;
      const t = new Date(row.workouts.started_at).getTime();
      const rexId = row.routine_exercise_id;
      if (!lastDates.has(rexId) || t > lastDates.get(rexId)!) {
        lastDates.set(rexId, t);
        lastCounts.set(rexId, Math.max(1, (row.sets || []).length));
      }
    }

    for (const [i, rex] of exercises.entries()) {
      const { data: wex } = await supabase
        .from("workout_exercises")
        .insert({
          user_id: uid,
          workout_id: w.id,
          routine_exercise_id: rex.id,
          exercise_name: rex.exercise_name,
          position: i,
        })
        .select()
        .single();
      if (!wex) continue;
      const count = lastCounts.get(rex.id) || rex.default_sets || 3;
      const rows = Array.from({ length: count }).map((_, si) => ({
        user_id: uid,
        workout_exercise_id: (wex as any).id,
        set_index: si,
      }));
      await supabase.from("sets").insert(rows);
    }

    router.push(`/workout/${w.id}`);
  };

  if (!routine) return <p className="text-dim text-center pt-16">Loading…</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <button onClick={() => router.push("/routines")} className="text-accent text-sm font-semibold">
          ‹ Routines
        </button>
        <button onClick={() => setRenaming(true)} className="text-dim text-sm">
          Rename
        </button>
      </div>

      {renaming ? (
        <div className="flex gap-2 mb-4">
          <input
            autoFocus
            className="flex-1 bg-card border border-line rounded-lg px-3 py-2 text-xl font-bold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
          />
          <button onClick={saveName} className="bg-accent text-black font-bold rounded-lg px-4">
            Save
          </button>
        </div>
      ) : (
        <h1 className="text-3xl font-extrabold mb-4">{routine.name}</h1>
      )}

      <button
        onClick={startWorkout}
        disabled={starting}
        className="w-full bg-card border border-line rounded-2xl p-4 text-accent font-bold text-left mb-4 disabled:opacity-60"
      >
        {starting ? "Starting…" : "Start this Workout"}
      </button>

      <div className="bg-card border border-line rounded-2xl divide-y divide-line mb-4">
        {exercises.map((rex, i) => (
          <div key={rex.id} className="p-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-bold">{rex.exercise_name}</div>
                <div className="text-dim text-sm">{rex.default_sets} Sets default</div>
                {rex.note && <div className="text-accent/80 text-xs mt-1">Note: {rex.note}</div>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => move(i, -1)} className="w-8 h-8 border border-line rounded text-dim">
                  ↑
                </button>
                <button onClick={() => move(i, 1)} className="w-8 h-8 border border-line rounded text-dim">
                  ↓
                </button>
                <button
                  onClick={() => removeExercise(rex)}
                  className="w-8 h-8 border border-line rounded text-danger"
                >
                  −
                </button>
              </div>
            </div>
          </div>
        ))}
        {exercises.length === 0 && (
          <p className="text-dim text-sm p-4">No exercises yet. Add your first below.</p>
        )}
      </div>

      <button
        onClick={() => setPicking(true)}
        className="w-full border border-dashed border-line rounded-2xl p-4 text-accent font-semibold"
      >
        + Add Exercise
      </button>

      <p className="text-dim text-xs mt-4 leading-relaxed">
        Progress for each exercise is tracked separately per routine. Bench in this routine and bench
        in another routine keep independent history and PRs.
      </p>

      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}
    </div>
  );
}
