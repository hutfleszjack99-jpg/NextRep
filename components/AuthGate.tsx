"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready)
    return <div className="min-h-screen flex items-center justify-center text-dim">Loading…</div>;
  if (!session) return <Login />;
  return <>{children}</>;
}

function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg("");
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg(error.message);
      else setMsg("Account created. If email confirmation is on, check your inbox, then sign in.");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-accent tracking-widest text-sm mb-1">▮▮▮</div>
          <h1 className="text-2xl font-extrabold tracking-[0.2em]">NEXTREP</h1>
          <p className="text-dim text-sm mt-2">Progressive overload, tracked per set</p>
        </div>
        <div className="bg-card border border-line rounded-2xl p-5">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "signin" ? "bg-accent text-accentText" : "text-dim"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "signup" ? "bg-accent text-accentText" : "text-dim"}`}
            >
              Create account
            </button>
          </div>
          <input
            className="w-full bg-bg border border-line rounded-lg px-3 py-3 mb-3"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full bg-bg border border-line rounded-lg px-3 py-3 mb-4"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button
            onClick={submit}
            disabled={busy || !email || !password}
            className="w-full bg-accent text-accentText font-bold rounded-lg py-3 disabled:opacity-50"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          {msg && <p className="text-dim text-sm mt-3">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
