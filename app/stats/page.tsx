"use client";
import { useEffect, useMemo, useState } from "react";
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
import { StatsSkeleton } from "@/components/Skeletons";
import { supabase } from "@/lib/supabaseClient";
import { loadHistory, computePRs, computeMovers, fmtDuration, sessionDurationMs } from "@/lib/data";
import type { Mover } from "@/lib/data";
import type { HistorySession, PR } from "@/lib/types";

export default function StatsPage() {
  return (
    <Shell>
      <StatsInner />
    </Shell>
  );
}

type RexOption = { id: string; label: string };

const fmtSet = (s: { weight: number; reps: number }) =>
  `${s.weight} × ${s.reps}`;

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });


function StatsInner() {
  const [overall, setOverall] = useState<{
    workouts: number;
    avgDurationMs: number;
    volume: number;
    sets: number;
    reps: number;
    bodyweights: { date: string; bw: number }[];
  } | null>(null);
  const [rexOptions, setRexOptions] = useState<RexOption[]>([]);
  const [selectedRex, setSelectedRex] = useState<string>("");
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [movers, setMovers] = useState<{ stalled: Mover[]; progressing: Mover[] } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("workouts")
        .select("id, started_at, finished_at, bodyweight, workout_exercises(sets(weight, reps, completed_at))")
        .not("finished_at", "is", null)
        .order("started_at", { ascending: true });

      let volume = 0,
        setCount = 0,
        repCount = 0,
        durTotal = 0,
        durCount = 0;
      const bodyweights: { date: string; bw: number }[] = [];
      const rows = (data as any[]) || [];
      for (const w of rows) {
        const times: string[] = [];
        for (const e of w.workout_exercises || []) {
          for (const s of e.sets || []) {
            if (s.weight != null && s.reps != null) {
              volume += Number(s.weight) * Number(s.reps);
              setCount += 1;
              repCount += Number(s.reps);
              if (s.completed_at) times.push(s.completed_at);
            }
          }
        }
        const dur = sessionDurationMs(w.started_at, w.finished_at, times);
        if (dur > 0) {
          durTotal += dur;
          durCount += 1;
        }
      }

      // Bodyweight comes from its own table now, so entries logged on rest days
      // show up too, not just weights recorded during a workout.
      const { data: bwRows } = await supabase
        .from("bodyweight_entries")
        .select("entry_date, weight")
        .order("entry_date", { ascending: true });
      for (const b of (bwRows as any[]) || []) {
        bodyweights.push({
          date: new Date(b.entry_date + "T00:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          bw: Number(b.weight),
        });
      }

      setOverall({
        workouts: rows.length,
        avgDurationMs: durCount ? durTotal / durCount : 0,
        volume,
        sets: setCount,
        reps: repCount,
        bodyweights,
      });

      // routine exercise options labeled "Routine · Exercise"
      const { data: rex } = await supabase
        .from("routine_exercises")
        .select("id, exercise_name, position, routines!inner(name)")
        .order("position", { ascending: true });
      const opts = ((rex as any[]) || []).map((r) => ({
        id: r.id,
        label: `${r.routines.name} · ${r.exercise_name}`,
      }));
      setRexOptions(opts);
      if (opts.length) setSelectedRex(opts[0].id);

      // Load history for every exercise at once to find stalled vs progressing lifts.
      if (opts.length) {
        const allHist = await loadHistory(opts.map((o) => o.id), null);
        const histories = opts.map((o) => {
          const label = o.label;
          const exerciseName = label.includes(" · ") ? label.split(" · ")[1] : label;
          return {
            routineExerciseId: o.id,
            name: label,
            exerciseName,
            sessions: allHist.get(o.id) || [],
          };
        });
        setMovers(computeMovers(histories, { stallThreshold: 3, minSessions: 3 }));
      } else {
        setMovers({ stalled: [], progressing: [] });
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRex) return;
    loadHistory([selectedRex], null).then((m) => setSessions(m.get(selectedRex) || []));
  }, [selectedRex]);

  const prs: Map<number, PR> = useMemo(() => computePRs(sessions), [sessions]);

  const chartData = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
        .map((s) => ({
          date: new Date(s.started_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          top: Math.max(...s.sets.map((x) => x.weight)),
          volume: s.sets.reduce((v, x) => v + x.weight * x.reps, 0),
        })),
    [sessions]
  );

  if (!overall) return <StatsSkeleton />;

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-4">Statistics</h1>

      {movers && (movers.stalled.length > 0 || movers.progressing.length > 0) && (
        <div className="mb-6">
          {movers.stalled.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-dim mb-2">
                Needs attention
              </div>
              <div className="bg-card border border-line rounded-2xl overflow-hidden mb-4">
                {movers.stalled.map((m, i) => (
                  <div
                    key={m.routineExerciseId}
                    className={`p-3.5 ${i < movers.stalled.length - 1 ? "border-b border-line" : ""}`}
                  >
                    <div className="flex justify-between items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{m.exerciseName}</span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={
                          (m.sessionsStalled ?? 0) >= 4
                            ? { background: "rgba(255,107,107,0.15)", color: "#FF6B6B" }
                            : { background: "rgba(232,185,106,0.15)", color: "#E8B96A" }
                        }
                      >
                        STALLED {m.sessionsStalled} {m.sessionsStalled === 1 ? "SESSION" : "SESSIONS"}
                      </span>
                    </div>
                    <div className="text-xs text-dim font-mono">
                      Stuck at {fmtSet(m.current)}
                      {m.lastGain && ` · last gain ${fmtShort(m.lastGain)}`}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {movers.progressing.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-dim mb-2">
                Progressing well
              </div>
              <div className="bg-card border border-line rounded-2xl overflow-hidden">
                {movers.progressing.map((m, i) => (
                  <div
                    key={m.routineExerciseId}
                    className={`p-3.5 ${i < movers.progressing.length - 1 ? "border-b border-line" : ""}`}
                  >
                    <div className="flex justify-between items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{m.exerciseName}</span>
                      {m.lbPerMonth != null && m.lbPerMonth > 0 && (
                        <span className="text-xs font-bold text-accent2 font-mono whitespace-nowrap">
                          +{Math.round(m.lbPerMonth)} lb/mo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-dim font-mono">
                      Now {fmtSet(m.current)}
                      {m.prev && ` · up from ${m.prev.weight}`}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="text-[11px] text-dim/70 mt-3 leading-relaxed px-0.5">
            A lift counts as stalled when your best set hasn&apos;t improved in 3+ sessions. Needs a
            few logged sessions per exercise to show up.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Stat label="Workouts" value={String(overall.workouts)} />
        <Stat label="Avg Duration" value={overall.avgDurationMs > 0 ? fmtDuration(overall.avgDurationMs) : "—"} />
        <Stat label="Total Volume" value={`${Math.round(overall.volume).toLocaleString()} lb`} />
        <Stat label="Total Sets" value={overall.sets.toLocaleString()} />
        <Stat label="Total Reps" value={overall.reps.toLocaleString()} />
        <Stat
          label="Reps per Set"
          value={overall.sets ? (overall.reps / overall.sets).toFixed(1) : "0"}
        />
      </div>

      {overall.bodyweights.length > 0 && (
        <div className="bg-card border border-line rounded-2xl p-4 mb-5">
          <div className="text-[10px] uppercase tracking-wider text-dim mb-3">Bodyweight</div>
          <div className="h-40">
            <ResponsiveContainer>
              <LineChart data={overall.bodyweights} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#282A34" vertical={false} />
                <XAxis dataKey="date" stroke="#8A8798" fontSize={11} tickLine={false} />
                <YAxis stroke="#8A8798" fontSize={11} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "#17181F",
                    border: "1px solid #282A34",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="bw" name="lb" stroke="#C9C0F5" strokeWidth={2} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <h2 className="font-bold mb-2">Exercises</h2>
      {rexOptions.length === 0 ? (
        <p className="text-dim text-sm">Build a routine first, then stats show up here.</p>
      ) : (
        <>
          <select
            className="w-full bg-card border border-line rounded-xl px-3 py-3 mb-4"
            value={selectedRex}
            onChange={(e) => setSelectedRex(e.target.value)}
          >
            {rexOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="bg-card border border-line rounded-2xl p-4 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-dim mb-3">
              Top set weight per session
            </div>
            {chartData.length < 2 ? (
              <p className="text-dim text-sm py-4 text-center">Not enough sessions yet.</p>
            ) : (
              <div className="h-48">
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
          </div>

          <div className="bg-card border border-line rounded-2xl p-4 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-dim mb-2">Per-set PRs</div>
            {prs.size === 0 ? (
              <p className="text-dim text-sm py-2">No completed sets yet.</p>
            ) : (
              [...prs.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([idx, pr]) => (
                  <div key={idx} className="flex justify-between py-2 border-t border-line first:border-0 text-sm">
                    <span className="text-dim font-mono">Set {idx + 1}</span>
                    <span className="font-mono">
                      {pr.weight} × {pr.reps}
                    </span>
                  </div>
                ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{label}</div>
      <div className="font-mono font-bold text-lg">{value}</div>
    </div>
  );
}
