"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import SwipeToDelete from "@/components/SwipeToDelete";
import { supabase } from "@/lib/supabaseClient";
import { fmtDuration, sessionDurationMs } from "@/lib/data";

type LogEntry = {
  id: string;
  routine_name: string;
  started_at: string;
  finished_at: string | null;
  durationMs: number;
  exercises: { name: string; setCount: number }[];
};

export default function LogPage() {
  return (
    <Shell>
      <LogInner />
    </Shell>
  );
}

function LogInner() {
  const router = useRouter();
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<{ id: string; routine_name: string } | null>(null);

  const deleteWorkout = async (id: string) => {
    if (!confirm("Delete this workout? This removes it from your log and stats permanently.")) return;
    const { error } = await supabase.from("workouts").delete().eq("id", id);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
  };

  useEffect(() => {
    (async () => {
      const { data: unfinished } = await supabase
        .from("workouts")
        .select("id, routine_name")
        .is("finished_at", null)
        .order("started_at", { ascending: false })
        .limit(1);
      if (unfinished && unfinished.length) setActiveWorkout(unfinished[0] as any);

      const { data } = await supabase
        .from("workouts")
        .select(
          "id, routine_name, started_at, finished_at, workout_exercises(exercise_name, position, sets(completed_at, weight, reps))"
        )
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false });

      const list: LogEntry[] = ((data as any[]) || []).map((w) => {
        const completedTimes: string[] = [];
        const exercises = (w.workout_exercises || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((e: any) => {
            const logged = (e.sets || []).filter(
              (s: any) => s.weight != null && s.reps != null
            );
            logged.forEach((s: any) => {
              if (s.completed_at) completedTimes.push(s.completed_at);
            });
            return { name: e.exercise_name, setCount: logged.length };
          })
          .filter((e: any) => e.setCount > 0);
        return {
          id: w.id,
          routine_name: w.routine_name,
          started_at: w.started_at,
          finished_at: w.finished_at,
          durationMs: sessionDurationMs(w.started_at, w.finished_at, completedTimes),
          exercises,
        };
      });
      setEntries(list);
    })();
  }, []);

  if (entries === null) return <p className="text-dim text-center pt-16">Loading…</p>;

  // group by month
  const groups: { label: string; items: LogEntry[] }[] = [];
  for (const e of entries) {
    const d = new Date(e.started_at);
    const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    let g = groups.find((x) => x.label === label);
    if (!g) {
      g = { label, items: [] };
      groups.push(g);
    }
    g.items.push(e);
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-4">Log</h1>

      {activeWorkout && (
        <Link
          href={`/workout/${activeWorkout.id}`}
          className="block bg-accent text-accentText font-bold rounded-xl px-4 py-3 mb-5 text-center"
        >
          Resume workout: {activeWorkout.routine_name}
        </Link>
      )}

      {groups.length === 0 && (
        <p className="text-dim text-center pt-12 leading-relaxed">
          No workouts yet.
          <br />
          Go to Routines to build one and start your first session.
        </p>
      )}

      {groups.map((g) => (
        <div key={g.label} className="mb-6">
          <div className="flex justify-between items-baseline mb-2 px-1">
            <span className="font-semibold text-dim">{g.label}</span>
            <span className="text-dim text-sm">
              {g.items.length} Workout{g.items.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="bg-card border border-line rounded-2xl divide-y divide-line overflow-hidden">
            {g.items.map((e) => {
              const d = new Date(e.started_at);
              return (
                <SwipeToDelete key={e.id} onDelete={() => deleteWorkout(e.id)}>
                  <button
                    onClick={() => router.push(`/log/${e.id}`)}
                    className="w-full text-left flex gap-4 p-4 active:bg-white/5"
                  >
                    <div className="w-12 shrink-0 text-center">
                      <div className="text-[11px] text-dim bg-bg rounded-t-md pt-1">
                        {d.toLocaleDateString(undefined, { weekday: "short" })}
                      </div>
                      <div className="text-xl font-bold bg-bg rounded-b-md pb-1">{d.getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="font-bold truncate">{e.routine_name}</span>
                        <span className="text-dim text-sm shrink-0">{e.durationMs > 0 ? fmtDuration(e.durationMs) : "—"}</span>
                      </div>
                      <div className="text-sm text-[#A9A6B8] leading-relaxed">
                        {e.exercises.map((x, xi) => (
                          <div key={xi}>
                            {x.setCount}x {x.name}
                          </div>
                        ))}
                      </div>
                      <div className="text-dim text-xs mt-1">Tap to view ›</div>
                    </div>
                  </button>
                </SwipeToDelete>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
