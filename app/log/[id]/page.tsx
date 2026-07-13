"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { DetailSkeleton } from "@/components/Skeletons";
import { supabase } from "@/lib/supabaseClient";
import { fmtDuration, sessionDurationMs } from "@/lib/data";

export default function LogDetailPage() {
  return (
    <Shell>
      <LogDetail />
    </Shell>
  );
}

type EditSet = { id: string; set_index: number; weight: string; reps: string };
type EditEx = { wexId: string; name: string; position: number; sets: EditSet[] };

function LogDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<{
    routine_name: string;
    started_at: string;
    finished_at: string | null;
  } | null>(null);
  const [bodyweight, setBodyweight] = useState("");
  const [exercises, setExercises] = useState<EditEx[]>([]);
  const [completedTimes, setCompletedTimes] = useState<string[]>([]);
  const [deletedSetIds, setDeletedSetIds] = useState<string[]>([]);

  const load = async () => {
    const { data: w } = await supabase
      .from("workouts")
      .select(
        "id, routine_name, started_at, finished_at, bodyweight, workout_exercises(id, exercise_name, position, sets(id, set_index, weight, reps, completed_at))"
      )
      .eq("id", params.id)
      .single();

    if (!w) {
      setLoading(false);
      return;
    }
    const times: string[] = [];
    const exs: EditEx[] = ((w as any).workout_exercises || [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((e: any) => {
        const sets = (e.sets || [])
          .sort((a: any, b: any) => a.set_index - b.set_index)
          .map((s: any) => {
            if (s.completed_at) times.push(s.completed_at);
            return {
              id: s.id,
              set_index: s.set_index,
              weight: s.weight != null ? String(s.weight) : "",
              reps: s.reps != null ? String(s.reps) : "",
            };
          });
        return { wexId: e.id, name: e.exercise_name, position: e.position, sets };
      });
    setMeta({
      routine_name: (w as any).routine_name,
      started_at: (w as any).started_at,
      finished_at: (w as any).finished_at,
    });
    setBodyweight((w as any).bodyweight != null ? String((w as any).bodyweight) : "");
    setExercises(exs);
    setCompletedTimes(times);
    setDeletedSetIds([]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [params.id]);

  const clean = (v: string) => {
    let s = v.replace(/[^0-9.]/g, "");
    const d = s.indexOf(".");
    if (d !== -1) s = s.slice(0, d + 1) + s.slice(d + 1).replace(/\./g, "");
    return s;
  };

  const setField = (exIdx: number, setIdx: number, field: "weight" | "reps", v: string) => {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === exIdx
          ? { ...e, sets: e.sets.map((s, j) => (j === setIdx ? { ...s, [field]: clean(v) } : s)) }
          : e
      )
    );
  };

  const addSet = (exIdx: number) => {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx) return e;
        const nextIdx = e.sets.length ? Math.max(...e.sets.map((s) => s.set_index)) + 1 : 0;
        return {
          ...e,
          sets: [...e.sets, { id: "new-" + Date.now() + "-" + nextIdx, set_index: nextIdx, weight: "", reps: "" }],
        };
      })
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx) return e;
        const target = e.sets[setIdx];
        if (target && !target.id.startsWith("new-")) setDeletedSetIds((d) => [...d, target.id]);
        return { ...e, sets: e.sets.filter((_, j) => j !== setIdx) };
      })
    );
  };

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSaving(false);
      return;
    }

    // bodyweight
    const bw = bodyweight.trim() === "" ? null : parseFloat(bodyweight);
    await supabase
      .from("workouts")
      .update({ bodyweight: bw == null || isNaN(bw) ? null : bw })
      .eq("id", params.id);

    // deletions
    if (deletedSetIds.length) {
      await supabase.from("sets").delete().in("id", deletedSetIds);
    }

    // upserts: existing sets update, new sets insert
    for (const ex of exercises) {
      for (let j = 0; j < ex.sets.length; j++) {
        const s = ex.sets[j];
        const weight = s.weight === "" || s.weight === "." ? null : parseFloat(s.weight);
        const reps = s.reps === "" || s.reps === "." ? null : parseFloat(s.reps);
        const wVal = weight == null || isNaN(weight) ? null : weight;
        const rVal = reps == null || isNaN(reps) ? null : reps;
        if (s.id.startsWith("new-")) {
          await supabase.from("sets").insert({
            user_id: uid,
            workout_exercise_id: ex.wexId,
            set_index: j,
            weight: wVal,
            reps: rVal,
          });
        } else {
          await supabase.from("sets").update({ set_index: j, weight: wVal, reps: rVal }).eq("id", s.id);
        }
      }
    }

    setSaving(false);
    setEditing(false);
    await load();
  };

  if (loading) return <DetailSkeleton />;
  if (!meta) return <p className="text-dim text-center pt-16">Workout not found.</p>;

  const d = new Date(meta.started_at);
  const durationMs = sessionDurationMs(meta.started_at, meta.finished_at, completedTimes);
  let volume = 0;
  let totalSets = 0;
  for (const ex of exercises)
    for (const s of ex.sets)
      if (s.weight !== "" && s.reps !== "") {
        volume += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
        totalSets += 1;
      }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <button onClick={() => router.push("/log")} className="text-accent text-sm font-semibold">
          ‹ Log
        </button>
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(false);
                load();
              }}
              className="text-dim text-sm"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="bg-accent text-accentText font-bold rounded-lg px-4 py-1.5 text-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-accent text-sm font-semibold">
            Edit
          </button>
        )}
      </div>

      <h1 className="text-3xl font-extrabold">{meta.routine_name}</h1>
      <p className="text-dim mb-4">
        {d.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      {!editing && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Stat label="Duration" value={durationMs > 0 ? fmtDuration(durationMs) : "—"} />
          <Stat label="Sets" value={String(totalSets)} />
          <Stat label="Volume" value={`${Math.round(volume).toLocaleString()}`} />
        </div>
      )}

      <div className="bg-card border border-line rounded-2xl p-4 mb-4 flex items-center justify-between">
        <span className="text-dim text-sm">Bodyweight (lb)</span>
        {editing ? (
          <input
            className="bg-bg border border-line rounded px-2 py-1 w-24 text-right font-mono"
            inputMode="decimal"
            placeholder="—"
            value={bodyweight}
            onChange={(e) => setBodyweight(clean(e.target.value))}
          />
        ) : (
          <span className="font-mono">{bodyweight || "—"}</span>
        )}
      </div>

      {exercises.map((ex, exIdx) => (
        <div key={ex.wexId} className="bg-card border border-line rounded-2xl p-4 mb-4">
          <h2 className="font-bold mb-3">{ex.name}</h2>
          <div className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 text-[10px] uppercase tracking-wider text-dim mb-1 px-1">
            <span>Set</span>
            <span>Weight</span>
            <span>Reps</span>
            <span></span>
          </div>
          {ex.sets.map((s, setIdx) => (
            <div
              key={s.id}
              className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 py-1.5 border-t border-line items-center font-mono text-sm"
            >
              <span className="text-dim">{setIdx + 1}</span>
              {editing ? (
                <>
                  <input
                    className="bg-bg border border-line rounded px-1 py-1.5 text-center"
                    inputMode="decimal"
                    value={s.weight}
                    onChange={(e) => setField(exIdx, setIdx, "weight", e.target.value)}
                  />
                  <input
                    className="bg-bg border border-line rounded px-1 py-1.5 text-center"
                    inputMode="decimal"
                    value={s.reps}
                    onChange={(e) => setField(exIdx, setIdx, "reps", e.target.value)}
                  />
                  <button
                    onClick={() => removeSet(exIdx, setIdx)}
                    className="text-danger text-lg"
                    title="Remove set"
                  >
                    −
                  </button>
                </>
              ) : (
                <>
                  <span>{s.weight || "—"}</span>
                  <span>{s.reps || "—"}</span>
                  <span></span>
                </>
              )}
            </div>
          ))}
          {editing && (
            <button
              onClick={() => addSet(exIdx)}
              className="mt-2 text-accent font-semibold text-sm border border-dashed border-line rounded-lg w-full py-2"
            >
              ⊕ Add Set
            </button>
          )}
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
