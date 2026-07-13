"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const todayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const cleanDecimal = (v: string) => {
  let s = v.replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  return s;
};

export default function BodyweightCard() {
  const [date, setDate] = useState(todayStr());
  const [weight, setWeight] = useState("");
  const [saved, setSaved] = useState<number | null>(null); // what's stored for this date
  const [latest, setLatest] = useState<{ weight: number; entry_date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingDate, setEditingDate] = useState(false);

  // load the entry for the selected date, plus the most recent entry overall
  const load = async (forDate: string) => {
    const { data: onDate } = await supabase
      .from("bodyweight_entries")
      .select("weight")
      .eq("entry_date", forDate)
      .maybeSingle();
    const w = onDate ? Number((onDate as any).weight) : null;
    setSaved(w);
    setWeight(w != null ? String(w) : "");

    const { data: recent } = await supabase
      .from("bodyweight_entries")
      .select("weight, entry_date")
      .order("entry_date", { ascending: false })
      .limit(1);
    const r = (recent as any[])?.[0];
    setLatest(r ? { weight: Number(r.weight), entry_date: r.entry_date } : null);
  };

  useEffect(() => {
    load(date);
    // eslint-disable-next-line
  }, [date]);

  const save = async () => {
    const num = weight === "" || weight === "." ? null : parseFloat(weight);
    if (num == null || isNaN(num)) return;
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("bodyweight_entries")
      .upsert(
        { user_id: uid, entry_date: date, weight: num },
        { onConflict: "user_id,entry_date" }
      );
    if (error) alert("Could not save weight: " + error.message);
    await load(date);
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    await supabase.from("bodyweight_entries").delete().eq("entry_date", date);
    await load(date);
    setBusy(false);
  };

  const isToday = date === todayStr();
  const dirty = weight !== "" && parseFloat(weight) !== saved;

  // trend vs the previous entry
  let delta: number | null = null;
  if (saved != null && latest && latest.entry_date !== date) {
    delta = saved - latest.weight;
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4 mb-5">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] uppercase tracking-wider text-dim">Bodyweight</span>
        {editingDate ? (
          <input
            type="date"
            className="bg-bg border border-line rounded px-2 py-1 text-xs"
            value={date}
            max={todayStr()}
            onChange={(e) => {
              setDate(e.target.value);
              setEditingDate(false);
            }}
            onBlur={() => setEditingDate(false)}
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="text-dim text-xs underline decoration-dotted underline-offset-2"
          >
            {isToday
              ? "Today"
              : new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
            {" · change"}
          </button>
        )}
      </div>

      <div className="flex gap-2 items-center">
        <input
          className="flex-1 bg-bg border border-line rounded-lg px-3 py-2.5 font-mono text-lg"
          inputMode="decimal"
          placeholder={latest ? String(latest.weight) : "—"}
          value={weight}
          onChange={(e) => setWeight(cleanDecimal(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <span className="text-dim text-sm">lb</span>
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="bg-accent text-accentText font-bold rounded-lg px-4 py-2.5 disabled:opacity-40"
        >
          {busy ? "…" : saved != null && !dirty ? "Saved" : "Save"}
        </button>
      </div>

      <div className="flex justify-between items-center mt-2 min-h-[18px]">
        <span className="text-dim text-xs">
          {saved != null ? (
            <>
              Logged{" "}
              {delta != null && delta !== 0 && (
                <span className={delta > 0 ? "text-dim" : "text-accent2"}>
                  ({delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} lb since {new Date(latest!.entry_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })})
                </span>
              )}
            </>
          ) : latest ? (
            <>Last: {latest.weight} lb on {new Date(latest.entry_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</>
          ) : (
            "No weight logged yet"
          )}
        </span>
        {saved != null && (
          <button onClick={remove} disabled={busy} className="text-danger text-xs">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
