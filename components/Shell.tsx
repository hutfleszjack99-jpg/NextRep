"use client";
import AuthGate from "./AuthGate";
import BottomNav from "./BottomNav";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="max-w-lg mx-auto min-h-screen pb-32 px-4 pt-6">{children}</div>
      <BottomNav />
    </AuthGate>
  );
}
