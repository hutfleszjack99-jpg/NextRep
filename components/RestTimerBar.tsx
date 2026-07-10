"use client";
import { useEffect, useRef, useState } from "react";
import { fmtClock } from "@/lib/data";

// Inline rest countdown. Renders directly under the next set's row.
// Counts down from restSeconds, then turns green ("Ready") when rest is up.
export default function RestTimerBar({
  startedAt,
  restSeconds,
  soundEnabled,
  onDismiss,
}: {
  startedAt: number; // Date.now() when reps were entered
  restSeconds: number;
  soundEnabled: boolean;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const buzzed = useRef(false);

  useEffect(() => {
    buzzed.current = false;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt]);

  const elapsed = (now - startedAt) / 1000;
  const remaining = restSeconds - elapsed;
  const over = remaining <= 0;
  const pct = Math.max(0, Math.min(100, (remaining / restSeconds) * 100));

  // vibrate + optional beep once when it flips to ready
  // (vibrate: Android only, silent on iPhone; beep: Safari may block if no recent gesture)
  useEffect(() => {
    if (over && !buzzed.current) {
      buzzed.current = true;
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as any).vibrate?.([120, 60, 120]);
        }
      } catch {}
      if (soundEnabled) {
        try {
          const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (!Ctor) return;
          const ctx = new Ctor();
          const beep = (startAt: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0, startAt);
            gain.gain.linearRampToValueAtTime(0.2, startAt + 0.01);
            gain.gain.setValueAtTime(0.2, startAt + 0.12);
            gain.gain.linearRampToValueAtTime(0, startAt + 0.14);
            osc.connect(gain).connect(ctx.destination);
            osc.start(startAt);
            osc.stop(startAt + 0.16);
          };
          const t0 = ctx.currentTime;
          beep(t0);
          beep(t0 + 0.22);
          setTimeout(() => { try { ctx.close(); } catch {} }, 600);
        } catch {}
      }
    }
  }, [over, soundEnabled]);

  return (
    <div
      className={`rounded-lg border px-3 py-2 my-1 flex items-center justify-between transition-colors ${
        over ? "bg-accent2/15 border-accent2" : "bg-bg border-line"
      }`}
    >
      <div className="flex items-center gap-3 flex-1">
        <span
          className={`font-mono text-lg font-bold tabular-nums ${
            over ? "text-accent2" : "text-accent"
          }`}
        >
          {over ? "Ready" : fmtClock(remaining)}
        </span>
        {!over && (
          <div className="h-1.5 flex-1 max-w-[160px] bg-line rounded overflow-hidden">
            <div className="h-full bg-accent transition-all duration-200" style={{ width: `${pct}%` }} />
          </div>
        )}
        {over && <span className="text-accent2 text-sm font-semibold">Rest complete</span>}
      </div>
      <button onClick={onDismiss} className="text-dim text-xs font-semibold px-2 py-1">
        {over ? "Dismiss" : "Skip"}
      </button>
    </div>
  );
}
