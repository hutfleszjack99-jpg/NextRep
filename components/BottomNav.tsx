"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/log", label: "Log", icon: "▤" },
  { href: "/routines", label: "Routines", icon: "≡" },
  { href: "/stats", label: "Statistics", icon: "▥" },
  { href: "/profile", label: "Profile", icon: "◉" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-line z-40">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-[12px] font-semibold gap-1 ${active ? "text-accent" : "text-dim"}`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
