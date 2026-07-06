"use client";
import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  return (
    <Shell>
      <ProfileInner />
    </Shell>
  );
}

function ProfileInner() {
  const [email, setEmail] = useState("");
  const [restMin, setRestMin] = useState("3");
  const [restSec, setRestSec] = useState("0");
  const [barWeight, setBarWeight] = useState("45");
  const [saved, setSaved] = useState(false);
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      uidRef.current = user.id;
      setEmail(user.email || "");
      const { data: s } = await supabase
        .from("user_settings")
        .select("rest_seconds, bar_weight")
        .eq("user_id", user.id)
        .maybeSingle();
      if (s) {
        setRestMin(String(Math.floor((s as any).rest_seconds / 60)));
        setRestSec(String((s as any).rest_seconds % 60));
        setBarWeight(String((s as any).bar_weight));
      }
    })();
  }, []);

  const save = async () => {
    const uid = uidRef.current;
    if (!uid) return;
    const rest_seconds = Math.max(5, (parseInt(restMin) || 0) * 60 + (parseInt(restSec) || 0));
    const bar_weight = Number(barWeight) || 45;
    await supabase
      .from("user_settings")
      .upsert({ user_id: uid, rest_seconds, bar_weight }, { onConflict: "user_id" });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    location.href = "/";
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-4">Profile</h1>

      <div className="bg-card border border-line rounded-2xl p-4 mb-4">
        <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Signed in as</div>
        <div className="font-medium">{email}</div>
      </div>

      <div className="bg-card border border-line rounded-2xl p-4 mb-4">
        <div className="font-bold mb-1">Rest timer</div>
        <p className="text-dim text-sm mb-3">
          Starts automatically when you mark a set done. Counts down, then says Rest over.
        </p>
        <div className="flex items-center gap-2">
          <input
            className="w-20 bg-bg border border-line rounded-lg px-3 py-2.5 text-center font-mono"
            inputMode="numeric"
            value={restMin}
            onChange={(e) => setRestMin(e.target.value)}
          />
          <span className="text-dim text-sm">min</span>
          <input
            className="w-20 bg-bg border border-line rounded-lg px-3 py-2.5 text-center font-mono"
            inputMode="numeric"
            value={restSec}
            onChange={(e) => setRestSec(e.target.value)}
          />
          <span className="text-dim text-sm">sec</span>
        </div>
      </div>

      <div className="bg-card border border-line rounded-2xl p-4 mb-4">
        <div className="font-bold mb-1">Bar weight (lb)</div>
        <p className="text-dim text-sm mb-3">Used by the plate calculator.</p>
        <input
          className="w-28 bg-bg border border-line rounded-lg px-3 py-2.5 text-center font-mono"
          inputMode="decimal"
          value={barWeight}
          onChange={(e) => setBarWeight(e.target.value)}
        />
      </div>

      <button onClick={save} className="w-full bg-accent text-black font-bold rounded-xl py-3 mb-3">
        {saved ? "Saved ✓" : "Save settings"}
      </button>

      <button onClick={signOut} className="w-full border border-line text-dim rounded-xl py-3">
        Sign out
      </button>
    </div>
  );
}
