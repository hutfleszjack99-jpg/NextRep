"use client";
import { useEffect, useMemo, useState } from "react";
import { EXERCISE_LIBRARY, MUSCLE_GROUPS } from "@/lib/exercises";
import { supabase } from "@/lib/supabaseClient";

export default function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<string>(MUSCLE_GROUPS[0]);
  const [custom, setCustom] = useState<{ name: string; muscle_group: string }[]>([]);
  const [search, setSearch] = useState("");
  // when set, we're on the "pick a body part" step for a new custom exercise
  const [pendingCustom, setPendingCustom] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("custom_exercises")
      .select("name, muscle_group")
      .then(({ data }) => setCustom((data as any[]) || []));
  }, []);

  const allNames = useMemo(
    () => [...Object.values(EXERCISE_LIBRARY).flat(), ...custom.map((c) => c.name)],
    [custom]
  );

  const q = search.trim().toLowerCase();
  const searchResults = q ? allNames.filter((n) => n.toLowerCase().includes(q)) : null;
  const inGroup = [
    ...(EXERCISE_LIBRARY[group] || []),
    ...custom.filter((c) => c.muscle_group === group).map((c) => c.name),
  ];
  const list = searchResults ?? inGroup;

  // exact (case-insensitive) match already exists?
  const exactExists = q && allNames.some((n) => n.toLowerCase() === q);
  const showAddNew = q.length > 0 && !exactExists;

  const saveCustom = async (name: string, muscle: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    await supabase.from("custom_exercises").insert({ user_id: uid, name, muscle_group: muscle });
    onPick(name);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-[max(1rem,env(safe-area-inset-top))] px-3"
      onClick={onClose}
    >
      <div
        className="bg-card border border-line rounded-2xl w-full max-w-sm p-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {pendingCustom ? (
          // ---- step 2: choose a body part for the new exercise ----
          <>
            <div className="flex justify-between items-center mb-1">
              <button
                onClick={() => setPendingCustom(null)}
                className="text-accent text-sm font-semibold"
              >
                ‹ Back
              </button>
              <button onClick={onClose} className="text-dim px-2 text-lg">
                ✕
              </button>
            </div>
            <h3 className="font-bold mb-1">Add "{pendingCustom}"</h3>
            <p className="text-dim text-sm mb-3">Which body part is this?</p>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto">
              {MUSCLE_GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => saveCustom(pendingCustom, g)}
                  className="bg-bg border border-line rounded-xl py-3 text-sm font-semibold active:bg-white/5"
                >
                  {g}
                </button>
              ))}
            </div>
          </>
        ) : (
          // ---- step 1: search + browse ----
          <>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Add exercise</h3>
              <button onClick={onClose} className="text-dim px-2 text-lg">
                ✕
              </button>
            </div>

            <input
              autoFocus
              className="w-full bg-bg border border-line rounded-lg px-3 py-2.5 mb-3"
              placeholder="Search exercises"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {!searchResults && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
                {MUSCLE_GROUPS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroup(g)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      g === group ? "bg-accent text-accentText border-accent" : "border-line text-dim"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-y-auto flex-1 -mx-1 px-1">
              {list.map((n) => (
                <button
                  key={n}
                  onClick={() => onPick(n)}
                  className="w-full text-left py-3 border-b border-line text-sm active:bg-white/5"
                >
                  {n}
                </button>
              ))}

              {showAddNew && (
                <button
                  onClick={() => setPendingCustom(search.trim())}
                  className="w-full flex items-center gap-2 py-3 text-sm text-accent font-semibold active:bg-white/5"
                >
                  <span className="text-lg leading-none">+</span>
                  Add "{search.trim()}" as a new exercise
                </button>
              )}

              {list.length === 0 && !showAddNew && (
                <p className="text-dim text-sm py-4">No matches.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
