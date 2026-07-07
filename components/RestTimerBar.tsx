"use client";
import { useEffect, useState } from "react";
import { fmtClock } from "@/lib/data";

export default function RestTimerBar({
  startedAt,
  restSeconds,
  onDismiss,
}: {
  startedAt: number; // Date.now() when the set was marked done
  restSeconds: number;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now()); // restart the clock whenever a new set kicks off the timer
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [startedAt]);

  const elapsed = (now - startedAt) / 1000;
  const remaining = restSeconds - elapsed;
  const over = remaining <= 0;
  const pct = Math.max(0, Math.min(100, (remaining / restSeconds) * 100));

  return (
    <div className="fixed bottom-[68px] left-0 right-0 z-40 px-4">
      <div
        className={`max-w-lg mx-auto rounded-xl border px-4 py-3 flex items-center justify-between shadow-lg ${
          over ? "bg-[#2A1518] border-danger" : "bg-card border-line"
        }`}
      >
        <div>
          <div className={`font-mono text-xl font-bold ${over ? "text-danger" : "text-accent"}`}>
            {over ? "Rest over" : fmtClock(remaining)}
          </div>
          {!over && (
            <div className="h-1 w-32 bg-line rounded mt-1.5 overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <button onClick={onDismiss} className="text-dim text-sm font-semibold px-3 py-2">
          {over ? "Dismiss" : "Skip"}
        </button>
      </div>
    </div>
  );
}
