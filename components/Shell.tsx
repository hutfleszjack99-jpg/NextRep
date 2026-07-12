"use client";
import { usePathname } from "next/navigation";
import AuthGate from "./AuthGate";
import BottomNav from "./BottomNav";
import StaleWorkoutPrompt from "./StaleWorkoutPrompt";

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // Don't nag about an unfinished workout while you're actively inside one.
  const inWorkout = path?.startsWith("/workout/");

  return (
    <AuthGate>
      <div className="max-w-lg mx-auto min-h-screen pb-28 px-4 pt-6">{children}</div>
      <BottomNav />
      {!inWorkout && <StaleWorkoutPrompt />}
    </AuthGate>
  );
}
