"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import BodyweightCard from "@/components/BodyweightCard";
import { ListSkeleton } from "@/components/Skeletons";
import { supabase } from "@/lib/supabaseClient";
import type { Routine } from "@/lib/types";

export default function RoutinesPage() {
  return (
    <Shell>
      <RoutinesInner />
    </Shell>
  );
}

function RoutinesInner() {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("routines")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setRoutines((data as Routine[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    await supabase.from("routines").insert({ user_id: uid, name });
    setNewName("");
    setCreating(false);
    load();
  };

  const remove = async (r: Routine) => {
    if (!confirm(`Delete routine "${r.name}"? Past workouts stay in your log.`)) return;
    await supabase.from("routines").delete().eq("id", r.id);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setEditMode((e) => !e)} className="text-accent text-sm font-semibold">
          {editMode ? "Done" : "Edit"}
        </button>
        <button
          onClick={() => setCreating(true)}
          className="w-9 h-9 bg-accent text-accentText rounded-full text-xl font-bold leading-none"
        >
          +
        </button>
      </div>
      <h1 className="text-3xl font-extrabold mb-4">Routines</h1>

      <BodyweightCard />

      {creating && (
        <div className="bg-card border border-line rounded-2xl p-4 mb-4">
          <input
            autoFocus
            className="w-full bg-bg border border-line rounded-lg px-3 py-3 mb-3"
            placeholder="Routine name (e.g. Push A)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <div className="flex gap-2">
            <button onClick={create} className="flex-1 bg-accent text-accentText font-bold rounded-lg py-2.5">
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-4 border border-line rounded-lg text-dim"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {routines === null ? (
        <ListSkeleton title={false} />
      ) : routines.length === 0 && !creating ? (
        <p className="text-dim text-center pt-12 leading-relaxed">
          No routines yet. Tap + to build your first one.
        </p>
      ) : (
        <div className="bg-card border border-line rounded-2xl divide-y divide-line">
          {routines.map((r) => (
            <div key={r.id} className="flex items-center">
              {editMode && (
                <button onClick={() => remove(r)} className="pl-4 text-danger text-lg">
                  −
                </button>
              )}
              <Link href={`/routines/${r.id}`} className="flex-1 flex justify-between items-center p-4">
                <span className="font-medium">{r.name}</span>
                <span className="text-dim">›</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
