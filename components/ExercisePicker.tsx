"use client";
import { useEffect, useState } from "react";
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
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("custom_exercises")
      .select("name, muscle_group")
      .then(({ data }) => setCustom((data as any[]) || []));
  }, []);

  const addCustom = async () => {
    const name = newName.trim();
    if (!name) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    await supabase.from("custom_exercises").insert({ user_id: uid, name, muscle_group: group });
    setNewName("");
    onPick(name);
  };

  const inGroup = [
    ...(EXERCISE_LIBRARY[group] || []),
    ...custom.filter((c) => c.muscle_group === group).map((c) => c.name),
  ];

  const searchResults = search.trim()
    ? [
        ...Object.values(EXERCISE_LIBRARY).flat(),
        ...custom.map((c) => c.name),
      ].filter((n) => n.toLowerCase().includes(search.toLowerCase()))
    : null;

  const list = searchResults ?? inGroup;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card border border-line rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 max-h-[85vh] flex flex-col pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold">Add exercise</h3>
          <button onClick={onClose} className="text-dim px-2 text-lg">✕</button>
        </div>

        <input
          className="w-full bg-bg border border-line rounded-lg px-3 py-2.5 mb-3"
          placeholder="Search all exercises"
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
                  g === group ? "bg-accent text-black border-accent" : "border-line text-dim"
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
              className="w-full text-left py-3 border-b border-line text-sm"
            >
              {n}
            </button>
          ))}
          {list.length === 0 && <p className="text-dim text-sm py-4">No matches.</p>}
        </div>

        <div className="pt-3 mt-2 border-t border-line">
          <p className="text-xs text-dim mb-2">Custom exercise (saved under {group})</p>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-bg border border-line rounded-lg px-3 py-2.5"
              placeholder="e.g. Landmine Press"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <button onClick={addCustom} className="bg-accent text-black font-bold rounded-lg px-4">
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
