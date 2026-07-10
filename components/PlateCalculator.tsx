"use client";
import { useMemo, useState } from "react";

const DENOMS = [45, 35, 25, 10, 5, 2.5];

export default function PlateCalculator({
  barWeight,
  onApply,
  onClose,
}: {
  barWeight: number;
  onApply: (total: number) => void;
  onClose: () => void;
}) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [includeBar, setIncludeBar] = useState(true);

  const total = useMemo(() => {
    const plates = DENOMS.reduce((s, d) => s + d * (counts[d] || 0), 0);
    return plates + (includeBar ? barWeight : 0);
  }, [counts, includeBar, barWeight]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card border border-line rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold">Plate calculator</h3>
          <button onClick={onClose} className="text-dim px-2 text-lg">✕</button>
        </div>
        <label className="flex items-center gap-2 text-sm text-dim mb-4">
          <input
            type="checkbox"
            checked={includeBar}
            onChange={(e) => setIncludeBar(e.target.checked)}
            className="accent-[#C9C0F5]"
          />
          Include bar ({barWeight} lb)
        </label>
        {DENOMS.map((d) => (
          <div key={d} className="flex justify-between items-center mb-2.5">
            <span className="font-mono text-sm">{d} lb</span>
            <div className="flex items-center gap-3">
              <button
                className="w-9 h-9 bg-bg border border-line rounded-lg text-lg"
                onClick={() => setCounts((c) => ({ ...c, [d]: Math.max(0, (c[d] || 0) - 1) }))}
              >
                −
              </button>
              <span className="font-mono w-6 text-center">{counts[d] || 0}</span>
              <button
                className="w-9 h-9 bg-bg border border-line rounded-lg text-lg"
                onClick={() => setCounts((c) => ({ ...c, [d]: (c[d] || 0) + 1 }))}
              >
                +
              </button>
            </div>
          </div>
        ))}
        <div className="font-mono font-bold text-accent text-lg my-3">Total: {total} lb</div>
        <div className="flex gap-2">
          <button
            className="flex-1 bg-accent text-accentText font-bold rounded-lg py-3"
            onClick={() => onApply(total)}
          >
            Use {total}
          </button>
          <button
            className="px-4 bg-bg border border-line rounded-lg text-dim"
            onClick={() => setCounts({})}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
