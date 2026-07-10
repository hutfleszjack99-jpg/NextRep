"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/log", label: "Log" },
  { href: "/routines", label: "Routines" },
  { href: "/stats", label: "Stats" },
  { href: "/profile", label: "Profile" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
      <div className="max-w-lg mx-auto bg-card border border-line rounded-full p-1.5 flex gap-1">
        {tabs.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 text-center rounded-full py-2.5 text-[13px] font-semibold transition-colors ${
                active ? "bg-accent text-accentText" : "text-dim"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
