"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Shell from "@/components/Shell";
import PlateCalculator from "@/components/PlateCalculator";
import RestTimerBar from "@/components/RestTimerBar";
import { supabase } from "@/lib/supabaseClient";
import { loadHistory, computePRs, fmtClock } from "@/lib/data";
import type { Workout, WorkoutExercise, SetRow, HistorySession, PR } from "@/lib/types";

export default function WorkoutPage() {
  return (
    <Shell>
      <WorkoutInner />
    </Shell>
  );
}

type ExState = WorkoutExercise & { sets: SetRow[]; note: string };

function WorkoutInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exs, setExs] = useState<ExState[]>([]);
  const [history, setHistory] = useState<Map<string, HistorySession[]>>(new Map());
  const [settings, setSettings] = useState({ rest_seconds: 180, rest_enabled: true, rest_sound_enabled: false, bar_weight: 45 });
  const [restTimer, setRestTimer] = useState<{ exIdx: number; afterSetIdx: number; at: number } | null>(
    null
  );
  const [plateTarget, setPlateTarget] = useState<{ exIdx: number; setIdx: number } | null>(null);
  const [chartFor, setChartFor] = useState<ExState | null>(null);
  const [now, setNow] = useState(Date.now());
  // raw text being typed, keyed "setId:weight" / "setId:reps", so decimals like "8." survive
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const noteTimers = useRef<Record<string, any>>({});

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Restore an in-progress rest timer when returning to this workout.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`restTimer:${params.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        // only restore if it hasn't been sitting stale for ages (10 min cap)
        if (parsed && typeof parsed.at === "number" && Date.now() - parsed.at < 600000) {
          setRestTimer(parsed);
        } else {
          sessionStorage.removeItem(`restTimer:${params.id}`);
        }
      }
    } catch {}
    // eslint-disable-next-line
  }, [params.id]);

  // Keep sessionStorage in sync so the timer survives leaving the page.
  useEffect(() => {
    try {
      if (restTimer) {
        sessionStorage.setItem(`restTimer:${params.id}`, JSON.stringify(restTimer));
      } else {
        sessionStorage.removeItem(`restTimer:${params.id}`);
      }
    } catch {}
  }, [restTimer, params.id]);

  useEffect(() => {
    (async () => {
      const { data: w } = await supabase.from("workouts").select("*").eq("id", params.id).single();
      setWorkout(w as Workout);

      const { data: wexData } = await supabase
        .from("workout_exercises")
        .select("*, sets(*)")
        .eq("workout_id", params.id)
        .order("position", { ascending: true });

      const rexIds = ((wexData as any[]) || [])
        .map((e) => e.routine_exercise_id)
        .filter(Boolean) as string[];

      // notes live on routine_exercises so they persist across sessions
      let notes = new Map<string, string>();
      if (rexIds.length) {
        const { data: rexData } = await supabase
          .from("routine_exercises")
          .select("id, note")
          .in("id", rexIds);
        for (const r of (rexData as any[]) || []) notes.set(r.id, r.note || "");
      }

      const list: ExState[] = ((wexData as any[]) || []).map((e) => ({
        ...e,
        note: e.routine_exercise_id ? notes.get(e.routine_exercise_id) || "" : "",
        sets: ((e.sets as SetRow[]) || []).sort((a, b) => a.set_index - b.set_index),
      }));
      setExs(list);

      setHistory(await loadHistory(rexIds, params.id));

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (uid) {
        const { data: s } = await supabase
          .from("user_settings")
          .select("rest_seconds, rest_enabled, rest_sound_enabled, bar_weight")
          .eq("user_id", uid)
          .maybeSingle();
        if (s) setSettings(s as any);
      }
    })();
    // eslint-disable-next-line
  }, [params.id]);

  const prsByRex = useMemo(() => {
    const m = new Map<string, Map<number, PR>>();
    for (const [rexId, sessions] of history) m.set(rexId, computePRs(sessions));
    return m;
  }, [history]);

  const lastByRex = useMemo(() => {
    const m = new Map<string, HistorySession>();
    for (const [rexId, sessions] of history) if (sessions.length) m.set(rexId, sessions[0]);
    return m;
  }, [history]);

  // ---- mutations ----
  const patchSet = (exIdx: number, setIdx: number, patch: Partial<SetRow>) => {
    setExs((prev) =>
      prev.map((e, i) =>
        i === exIdx
          ? { ...e, sets: e.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) }
          : e
      )
    );
  };

  const saveSet = async (set: SetRow, patch: Partial<SetRow>) => {
    await supabase.from("sets").update(patch).eq("id", set.id);
  };

  // sanitize to a valid decimal-in-progress: digits and a single dot
  const cleanDecimal = (v: string) => {
    let s = v.replace(/[^0-9.]/g, "");
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
    return s;
  };

  const onWeightChange = (setId: string, v: string) => {
    setDrafts((d) => ({ ...d, [`${setId}:weight`]: cleanDecimal(v) }));
  };
  const onRepsChange = (setId: string, v: string) => {
    setDrafts((d) => ({ ...d, [`${setId}:reps`]: cleanDecimal(v) }));
  };

  // commit a field's draft text to a real number on blur
  const commitField = async (exIdx: number, setIdx: number, field: "weight" | "reps") => {
    const s = exs[exIdx]?.sets[setIdx];
    if (!s) return;
    const key = `${s.id}:${field}`;
    const raw = drafts[key];
    if (raw === undefined) return; // nothing typed
    const num = raw === "" || raw === "." ? null : parseFloat(raw);
    const value = (num === null || isNaN(num) ? null : num) as any;
    patchSet(exIdx, setIdx, { [field]: value } as any);
    setDrafts((d) => {
      const n = { ...d };
      delete n[key];
      return n;
    });
    await supabase.from("sets").update({ [field]: value }).eq("id", s.id);
    // rest timer starts when you enter reps for a set (if enabled and a next set exists)
    if (field === "reps" && value != null && settings.rest_enabled) {
      const hasNext = setIdx + 1 < exs[exIdx].sets.length;
      if (hasNext) {
        setRestTimer({ exIdx, afterSetIdx: setIdx, at: Date.now() });
      }
    }
  };

  const persistSet = (exIdx: number, setIdx: number) => {
    const s = exs[exIdx]?.sets[setIdx];
    if (s) saveSet(s, { weight: s.weight, reps: s.reps });
  };

  const toggleDone = async (exIdx: number, setIdx: number) => {
    const s = exs[exIdx].sets[setIdx];
    if (s.completed_at) {
      patchSet(exIdx, setIdx, { completed_at: null });
      await saveSet(s, { completed_at: null, weight: s.weight, reps: s.reps });
    } else {
      const ts = new Date().toISOString();
      patchSet(exIdx, setIdx, { completed_at: ts });
      await saveSet(s, { completed_at: ts, weight: s.weight, reps: s.reps });
    }
  };

  const addSet = async (exIdx: number) => {
    const ex = exs[exIdx];
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      alert("Not signed in. Try reloading.");
      return;
    }
    const nextIndex = ex.sets.length ? Math.max(...ex.sets.map((s) => s.set_index)) + 1 : 0;
    const { data, error } = await supabase
      .from("sets")
      .insert({ user_id: uid, workout_exercise_id: ex.id, set_index: nextIndex })
      .select()
      .single();
    if (error) {
      alert("Could not add set: " + error.message);
      return;
    }
    if (data)
      setExs((prev) =>
        prev.map((e, i) => (i === exIdx ? { ...e, sets: [...e.sets, data as SetRow] } : e))
      );
  };

  const removeSet = async (exIdx: number, setIdx: number) => {
    const ex = exs[exIdx];
    if (ex.sets.length <= 1) {
      alert("An exercise needs at least one set. Remove the exercise from the routine instead.");
      return;
    }
    const s = ex.sets[setIdx];
    const { error } = await supabase.from("sets").delete().eq("id", s.id);
    if (error) {
      alert("Could not remove set: " + error.message);
      return;
    }
    // reindex remaining
    const remaining = ex.sets.filter((_, j) => j !== setIdx);
    for (let j = 0; j < remaining.length; j++) {
      if (remaining[j].set_index !== j) {
        await supabase.from("sets").update({ set_index: j }).eq("id", remaining[j].id);
        remaining[j] = { ...remaining[j], set_index: j };
      }
    }
    setExs((prev) => prev.map((e, i) => (i === exIdx ? { ...e, sets: remaining } : e)));
  };

  const onNoteChange = (exIdx: number, v: string) => {
    const ex = exs[exIdx];
    setExs((prev) => prev.map((e, i) => (i === exIdx ? { ...e, note: v } : e)));
    if (!ex.routine_exercise_id) return;
    clearTimeout(noteTimers.current[ex.id]);
    noteTimers.current[ex.id] = setTimeout(() => {
      supabase.from("routine_exercises").update({ note: v }).eq("id", ex.routine_exercise_id).then();
    }, 600);
  };

  const setBodyweight = async (v: string) => {
    if (!workout) return;
    const num = v === "" ? null : Number(v);
    setWorkout({ ...workout, bodyweight: (isNaN(num as any) ? null : num) as any });
    await supabase
      .from("workouts")
      .update({ bodyweight: isNaN(num as any) ? null : num })
      .eq("id", workout.id);
  };

  const finish = async () => {
    if (!workout) return;
    const anyLogged = exs.some((e) => e.sets.some((s) => s.weight != null && s.reps != null));
    if (!anyLogged && !confirm("No sets have weight and reps filled in. Finish anyway?")) return;
    // drop untouched empty sets to keep history clean
    for (const e of exs) {
      for (const s of e.sets) {
        if (!s.completed_at && s.weight == null && s.reps == null) {
          await supabase.from("sets").delete().eq("id", s.id);
        }
      }
    }
    await supabase
      .from("workouts")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", workout.id);
    try {
      sessionStorage.removeItem(`restTimer:${workout.id}`);
    } catch {}
    router.push("/log");
  };

  const discard = async () => {
    if (!workout) return;
    if (!confirm("Discard this workout entirely?")) return;
    await supabase.from("workouts").delete().eq("id", workout.id);
    try {
      sessionStorage.removeItem(`restTimer:${workout.id}`);
    } catch {}
    router.push("/log");
  };

  if (!workout) return <p className="text-dim text-center pt-16">Loading…</p>;

  const elapsed = (now - new Date(workout.started_at).getTime()) / 1000;

  return (
    <div className="pb-28">
      {/* header */}
      <div className="flex justify-between items-center mb-4">
        <button onClick={finish} className="bg-accent text-accentText font-bold rounded-full px-5 py-2">
          Finish
        </button>
        <div className="text-center">
          <div className="font-bold">{workout.routine_name}</div>
          <div className="text-dim text-xs font-mono">{fmtClock(elapsed)}</div>
        </div>
        <button onClick={discard} className="text-danger text-sm">
          Discard
        </button>
      </div>

      {/* session card */}
      <div className="bg-card border border-line rounded-2xl p-4 mb-4">
        <div className="flex justify-between py-1.5 border-b border-line text-sm">
          <span className="text-dim">Start Time</span>
          <span>
            {new Date(workout.started_at).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex justify-between items-center py-1.5 text-sm">
          <span className="text-dim">Bodyweight (lb)</span>
          <input
            className="bg-bg border border-line rounded px-2 py-1 w-24 text-right font-mono"
            inputMode="decimal"
            placeholder="—"
            value={workout.bodyweight ?? ""}
            onChange={(e) => setBodyweight(e.target.value)}
          />
        </div>
      </div>

      {/* exercise cards */}
      {exs.map((ex, exIdx) => {
        const rexId = ex.routine_exercise_id || "";
        const prs = prsByRex.get(rexId);
        const last = lastByRex.get(rexId);
        return (
          <div key={ex.id} className="bg-card border border-line rounded-2xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-bold text-lg">{ex.exercise_name}</h2>
              <button
                onClick={() => setChartFor(ex)}
                title="Progress chart"
                className="text-accent text-lg px-2"
              >
                📈
              </button>
            </div>

            <input
              className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm mb-3"
              placeholder="Note (e.g. bench 45 degrees) — saved for every session"
              value={ex.note}
              onChange={(e) => onNoteChange(exIdx, e.target.value)}
            />

            <div className="grid grid-cols-[28px_1fr_1fr_1.2fr_28px] gap-2 text-[10px] uppercase tracking-wider text-dim mb-1 px-1">
              <span>Set</span>
              <span>Weight</span>
              <span>Reps</span>
              <span>Last / PR</span>
              <span></span>
            </div>

            {ex.sets.map((s, setIdx) => {
              const prev = last?.sets.find((x) => x.set_index === s.set_index);
              const pr = prs?.get(s.set_index);
              const isPRBeat =
                pr &&
                s.weight != null &&
                s.reps != null &&
                (s.weight > pr.weight || (s.weight === pr.weight && s.reps > pr.reps));
              const isFirstPR = !pr && s.weight != null && s.reps != null && s.completed_at;
              const showTimerHere =
                restTimer && restTimer.exIdx === exIdx && restTimer.afterSetIdx === setIdx;
              return (
                <div key={s.id}>
                <div
                  className="grid grid-cols-[28px_1fr_1fr_1.2fr_28px] gap-2 items-center mb-2"
                >
                  <button
                    onClick={() => toggleDone(exIdx, setIdx)}
                    className={`w-7 h-7 rounded-full border text-xs font-bold ${
                      s.completed_at
                        ? "bg-accent2 border-accent2 text-black"
                        : "border-line text-dim"
                    }`}
                    title={s.completed_at ? "Marked done. Tap to undo." : "Mark set done"}
                  >
                    {s.completed_at ? "✓" : s.set_index + 1}
                  </button>

                  <div className="flex gap-1">
                    <input
                      className="w-full bg-bg border border-line rounded-lg px-1 py-2 text-center font-mono"
                      inputMode="decimal"
                      placeholder={prev ? String(prev.weight) : "0"}
                      value={drafts[`${s.id}:weight`] ?? (s.weight ?? "")}
                      onChange={(e) => onWeightChange(s.id, e.target.value)}
                      onBlur={() => commitField(exIdx, setIdx, "weight")}
                    />
                    <button
                      onClick={() => setPlateTarget({ exIdx, setIdx })}
                      className="shrink-0 w-8 bg-bg border border-line rounded-lg text-dim text-sm"
                      title="Plate calculator"
                    >
                      ▤
                    </button>
                  </div>

                  <input
                    className="w-full bg-bg border border-line rounded-lg px-1 py-2 text-center font-mono"
                    inputMode="decimal"
                    placeholder={prev ? String(prev.reps) : "0"}
                    value={drafts[`${s.id}:reps`] ?? (s.reps ?? "")}
                    onChange={(e) => onRepsChange(s.id, e.target.value)}
                    onBlur={() => commitField(exIdx, setIdx, "reps")}
                  />

                  <div className="text-[11px] font-mono leading-tight">
                    {prev ? (
                      <div className="text-dim">
                        {prev.weight}×{prev.reps}
                      </div>
                    ) : (
                      <div className="text-dim">—</div>
                    )}
                    {pr ? (
                      <div className={isPRBeat ? "text-accent2 font-bold" : "text-accent"}>
                        PR {pr.weight}×{pr.reps}
                        {isPRBeat ? " ✦ beat!" : ""}
                      </div>
                    ) : isFirstPR ? (
                      <div className="text-accent2 font-bold">First PR ✦</div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => removeSet(exIdx, setIdx)}
                    className="text-dim text-lg"
                    title="Remove set"
                  >
                    −
                  </button>
                </div>
                {showTimerHere && (
                  <RestTimerBar
                    startedAt={restTimer!.at}
                    restSeconds={settings.rest_seconds}
                    soundEnabled={settings.rest_sound_enabled}
                    onDismiss={() => setRestTimer(null)}
                  />
                )}
                </div>
              );
            })}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => addSet(exIdx)}
                className="flex-1 border border-dashed border-line rounded-lg py-2.5 text-accent font-semibold text-sm active:bg-white/5"
              >
                ⊕ Add Set
              </button>
              {ex.sets.length > 1 && (
                <button
                  onClick={() => removeSet(exIdx, ex.sets.length - 1)}
                  className="px-4 border border-line rounded-lg py-2.5 text-dim text-sm active:bg-white/5"
                >
                  − Remove last
                </button>
              )}
            </div>
          </div>
        );
      })}

      {plateTarget && (
        <PlateCalculator
          barWeight={settings.bar_weight}
          onClose={() => setPlateTarget(null)}
          onApply={async (total) => {
            const { exIdx, setIdx } = plateTarget;
            const s = exs[exIdx]?.sets[setIdx];
            patchSet(exIdx, setIdx, { weight: total as any });
            setDrafts((d) => {
              const n = { ...d };
              if (s) delete n[`${s.id}:weight`];
              return n;
            });
            if (s) await supabase.from("sets").update({ weight: total }).eq("id", s.id);
            setPlateTarget(null);
          }}
        />
      )}

      {chartFor && (
        <ExerciseChartModal
          ex={chartFor}
          sessions={history.get(chartFor.routine_exercise_id || "") || []}
          onClose={() => setChartFor(null)}
        />
      )}
    </div>
  );
}

function ExerciseChartModal({
  ex,
  sessions,
  onClose,
}: {
  ex: ExState;
  sessions: HistorySession[];
  onClose: () => void;
}) {
  const data = [...sessions]
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .map((s) => ({
      date: new Date(s.started_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      top: Math.max(...s.sets.map((x) => x.weight)),
    }));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-line rounded-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">{ex.exercise_name}</h3>
          <button onClick={onClose} className="text-dim px-2 text-lg">✕</button>
        </div>
        {data.length < 2 ? (
          <p className="text-dim text-sm py-6 text-center">
            Not enough history yet. Finish a couple sessions and the trend shows here.
          </p>
        ) : (
          <div className="h-52">
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#282A34" vertical={false} />
                <XAxis dataKey="date" stroke="#8A8798" fontSize={11} tickLine={false} />
                <YAxis stroke="#8A8798" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#17181F",
                    border: "1px solid #282A34",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="top"
                  name="Top weight (lb)"
                  stroke="#C9C0F5"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#C9C0F5" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-dim text-[11px] mt-3">Top set weight per session, this routine only.</p>
      </div>
    </div>
  );
}
