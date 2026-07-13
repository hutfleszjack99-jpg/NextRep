"use client";

// Full-screen splash shown while we work out whether you're signed in.
// Uses the app mark so the first thing you see is NextRep, not bare text.
export default function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg">
      <svg viewBox="0 0 120 120" className="w-20 h-20 mb-6" aria-hidden="true">
        <rect width="120" height="120" rx="26" fill="#17181F" />
        <rect x="12" y="56" width="26" height="8" rx="2" fill="#4E4964" />
        <rect x="40" y="50" width="6" height="20" rx="1.5" fill="#6E668F" />
        {/* plates pulse in sequence, like reps being counted */}
        <rect x="48" y="28" width="17" height="64" rx="3" fill="#C9C0F5" className="plate p1" />
        <rect x="69" y="28" width="17" height="64" rx="3" fill="#C9C0F5" className="plate p2" />
        <rect x="89" y="44" width="8" height="32" rx="2" fill="#C9C0F5" className="plate p3" />
      </svg>

      <p className="text-dim text-sm tracking-[0.2em] font-semibold">NEXTREP</p>

      <style>{`
        @keyframes plateFade {
          0%, 100% { opacity: 0.28; }
          50%      { opacity: 1; }
        }
        .plate { animation: plateFade 1.4s ease-in-out infinite; }
        .p1 { animation-delay: 0s; }
        .p2 { animation-delay: 0.18s; }
        .p3 { animation-delay: 0.36s; }

        @media (prefers-reduced-motion: reduce) {
          .plate { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
