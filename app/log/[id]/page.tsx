"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabaseClient";
import { fmtDuration, sessionDurationMs } from "@/lib/data";

export default function LogDetailPage() {
  return (
    <Shell>
      <LogDetail />
    </Shell>
  );
}

type Ex = { name: string; sets: { idx: number; weight: number; reps: number }[] };

function LogDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    routine_name: string;
    started_at: string;
    finished_at: string | null;
    bodyweight: number | null;
    durationMs: number;
    volume: number;
    totalSets: number;
    exercises: Ex[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: w } = await supabase
        .from("workouts")
        .select(
          "id, routine_name, started_at, finished_at, bodyweight, workout_exercises(exercise_name, position, sets(set_index, weight, reps, completed_at))"
        )
        .eq("id", params.id)
        .single();

      if (!w) {
        setLoading(false);
        return;
      }

      const times: string[] = [];
      let volume = 0;
      let totalSets = 0;
      const exercises: Ex[] = ((w as any).workout_exercises || [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((e: any) => {
          const sets = (e.sets || [])
            .filter((s: any) => s.weight != null && s.reps != null)
            .sort((a: any, b: any) => a.set_index - b.set_index)
            .map((s: any) => {
              if (s.completed_at) times.push(s.completed_at);
              volume += Number(s.weight) * Number(s.reps);
              totalSets += 1;
              return { idx: s.set_index, weight: Number(s.weight), reps: Number(s.reps) };
            });
          return { name: e.exercise_name, sets };
        })
        .filter((e: Ex) => e.sets.length > 0);

      setData({
        routine_name: (w as any).routine_name,
        started_at: (w as any).started_at,
        finished_at: (w as any).finished_at,
        bodyweight: (w as any).bodyweight,
        durationMs: sessionDurationMs((w as any).started_at, (w as any).finished_at, times),
        volume,
        totalSets,
        exercises,
      });
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <p className="text-dim text-center pt-16">Loading…</p>;
  if (!data) return <p className="text-dim text-center pt-16">Workout not found.</p>;

  const d = new Date(data.started_at);

  return (
    <div>
      <button onClick={() => router.push("/log")} className="text-accent text-sm font-semibold mb-3">
        ‹ Log
      </button>

      <h1 className="text-3xl font-extrabold">{data.routine_name}</h1>
      <p className="text-dim mb-4">
        {d.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Duration" value={fmtDuration(data.durationMs)} />
        <Stat label="Sets" value={String(data.totalSets)} />
        <Stat label="Volume" value={`${Math.round(data.volume).toLocaleString()}`} />
      </div>
      {data.bodyweight != null && (
        <div className="text-dim text-sm mb-5">Bodyweight that day: {data.bodyweight} lb</div>
      )}

      {data.exercises.map((ex, i) => (
        <div key={i} className="bg-card border border-line rounded-2xl p-4 mb-4">
          <h2 className="font-bold mb-3">{ex.name}</h2>
          <div className="grid grid-cols-[40px_1fr_1fr] gap-2 text-[10px] uppercase tracking-wider text-dim mb-1 px-1">
            <span>Set</span>
            <span>Weight</span>
            <span>Reps</span>
          </div>
          {ex.sets.map((s, j) => (
            <div key={j} className="grid grid-cols-[40px_1fr_1fr] gap-2 py-1.5 border-t border-line font-mono text-sm">
              <span className="text-dim">{s.idx + 1}</span>
              <span>{s.weight}</span>
              <span>{s.reps}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{label}</div>
      <div className="font-mono font-bold">{value}</div>
    </div>
  );
}
