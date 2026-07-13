"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { ListSkeleton } from "@/components/Skeletons";
import ExercisePicker from "@/components/ExercisePicker";
import { supabase } from "@/lib/supabaseClient";
import type { Routine, RoutineExercise } from "@/lib/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const onDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = exercises.findIndex((e) => e.id === active.id);
    const newIndex = exercises.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(exercises, oldIndex, newIndex);
    setExercises(reordered); // optimistic
    // persist new positions
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].position !== i) {
        await supabase.from("routine_exercises").update({ position: i }).eq("id", reordered[i].id);
      }
    }
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

  const changeSets = async (rex: RoutineExercise, delta: number) => {
    const next = Math.max(1, Math.min(20, (rex.default_sets || 3) + delta));
    if (next === rex.default_sets) return;
    // optimistic update so the number moves instantly
    setExercises((prev) => prev.map((e) => (e.id === rex.id ? { ...e, default_sets: next } : e)));
    const { error } = await supabase
      .from("routine_exercises")
      .update({ default_sets: next })
      .eq("id", rex.id);
    if (error) {
      alert("Could not update sets: " + error.message);
      load();
    }
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

  if (!routine) return <ListSkeleton />;

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
          <button onClick={saveName} className="bg-accent text-accentText font-bold rounded-lg px-4">
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className="bg-card border border-line rounded-2xl divide-y divide-line mb-4 overflow-hidden">
            {exercises.map((rex) => (
              <SortableExerciseRow
                key={rex.id}
                rex={rex}
                onChangeSets={changeSets}
                onRemove={removeExercise}
              />
            ))}
            {exercises.length === 0 && (
              <p className="text-dim text-sm p-4">No exercises yet. Add your first below.</p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {exercises.length > 1 && (
        <p className="text-dim text-xs mb-4 -mt-2 px-1">
          Tip: press and hold the ⠿ handle to drag an exercise into a new order.
        </p>
      )}

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

function SortableExerciseRow({
  rex,
  onChangeSets,
  onRemove,
}: {
  rex: RoutineExercise;
  onChangeSets: (rex: RoutineExercise, delta: number) => void;
  onRemove: (rex: RoutineExercise) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rex.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="p-4 bg-card">
      <div className="flex justify-between items-start gap-2">
        <div className="flex gap-3 items-start">
          <button
            {...attributes}
            {...listeners}
            className="text-dim text-xl leading-none mt-0.5 cursor-grab touch-none active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
          <div>
            <div className="font-bold">{rex.exercise_name}</div>
            <div className="text-[10px] uppercase tracking-wider text-dim mt-1.5">Sets</div>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => onChangeSets(rex, -1)}
                className="w-7 h-7 border border-line rounded-lg text-dim text-lg leading-none active:bg-white/5"
              >
                −
              </button>
              <span className="text-sm font-mono w-16 text-center">
                {rex.default_sets} set{rex.default_sets === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => onChangeSets(rex, 1)}
                className="w-7 h-7 border border-line rounded-lg text-dim text-lg leading-none active:bg-white/5"
              >
                +
              </button>
            </div>
            {rex.note && <div className="text-accent/80 text-xs mt-1">Note: {rex.note}</div>}
          </div>
        </div>
        <button
          onClick={() => onRemove(rex)}
          className="w-8 h-8 border border-line rounded text-danger shrink-0"
          aria-label="Remove exercise"
        >
          −
        </button>
      </div>
    </div>
  );
}
