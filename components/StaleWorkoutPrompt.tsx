"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const IDLE_MS = 60 * 60 * 1000; // 1 hour of no activity

type Stale = {
  id: string;
  routine_name: string;
  started_at: string;
  lastActivity: string | null; // timestamp of last logged set
};

// On app open, look for an unfinished workout that has gone quiet.
// Offer to finish it (backdated to the last logged set), resume, or discard.
export default function StaleWorkoutPrompt() {
  const router = useRouter();
  const [stale, setStale] = useState<Stale | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("workouts")
        .select("id, routine_name, started_at, workout_exercises(sets(completed_at))")
        .is("finished_at", null)
        .order("started_at", { ascending: false })
        .limit(1);

      const w = (data as any[])?.[0];
      if (!w) return;

      // most recent set timestamp across the whole workout
      let last: string | null = null;
      for (const e of w.workout_exercises || []) {
        for (const s of e.sets || []) {
          if (s.completed_at && (!last || s.completed_at > last)) last = s.completed_at;
        }
      }

      // "quiet since" = last set, or the start time if nothing was ever logged
      const quietSince = last ? new Date(last).getTime() : new Date(w.started_at).getTime();
      if (Date.now() - quietSince < IDLE_MS) return; // still active, leave it alone

      setStale({
        id: w.id,
        routine_name: w.routine_name,
        started_at: w.started_at,
        lastActivity: last,
      });
    })();
  }, []);

  if (!stale) return null;

  const finishIt = async () => {
    setBusy(true);
    // backdate to the last logged set so the duration is honest.
    // if nothing was logged, fall back to the start time (zero-length session).
    const endAt = stale.lastActivity || stale.started_at;
    // clean up sets that were never filled in
    const { data: wex } = await supabase
      .from("workout_exercises")
      .select("id, sets(id, weight, reps)")
      .eq("workout_id", stale.id);
    for (const e of (wex as any[]) || []) {
      for (const s of e.sets || []) {
        if (s.weight == null && s.reps == null) {
          await supabase.from("sets").delete().eq("id", s.id);
        }
      }
    }
    await supabase.from("workouts").update({ finished_at: endAt }).eq("id", stale.id);
    try {
      sessionStorage.removeItem(`restTimer:${stale.id}`);
    } catch {}
    setStale(null);
    setBusy(false);
    router.refresh();
  };

  const resume = () => {
    const id = stale.id;
    setStale(null);
    router.push(`/workout/${id}`);
  };

  const discard = async () => {
    if (!confirm("Delete this workout and everything logged in it?")) return;
    setBusy(true);
    await supabase.from("workouts").delete().eq("id", stale.id);
    try {
      sessionStorage.removeItem(`restTimer:${stale.id}`);
    } catch {}
    setStale(null);
    setBusy(false);
    router.refresh();
  };

  const when = new Date(stale.started_at).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const lastAt = stale.lastActivity
    ? new Date(stale.lastActivity).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-2xl w-full max-w-sm p-5">
        <h3 className="font-bold text-lg mb-1">Unfinished workout</h3>
        <p className="text-dim text-sm leading-relaxed mb-4">
          You left <span className="text-white font-semibold">{stale.routine_name}</span> open from{" "}
          {when}.{" "}
          {lastAt
            ? `Your last set was logged at ${lastAt}.`
            : "Nothing was logged in it."}
        </p>

        <button
          onClick={finishIt}
          disabled={busy}
          className="w-full bg-accent text-accentText font-bold rounded-xl py-3 mb-2 disabled:opacity-60"
        >
          {busy ? "Working…" : lastAt ? `Finish it (ends ${lastAt})` : "Finish it"}
        </button>
        <button
          onClick={resume}
          disabled={busy}
          className="w-full border border-line rounded-xl py-3 mb-2 font-semibold disabled:opacity-60"
        >
          Keep going
        </button>
        <button
          onClick={discard}
          disabled={busy}
          className="w-full text-danger text-sm py-2 disabled:opacity-60"
        >
          Discard it
        </button>

        <p className="text-dim text-[11px] mt-3 leading-relaxed">
          Finishing backdates the end time to your last set, so your duration stays accurate.
        </p>
      </div>
    </div>
  );
}
