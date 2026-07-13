"use client";

// Shimmering placeholder blocks. Showing the page's shape while data loads
// feels much faster than a bare "Loading..." line.

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`skel rounded-lg ${className}`} />;
}

export function SkeletonStyles() {
  return (
    <style>{`
      .skel {
        background: linear-gradient(
          90deg,
          rgba(255,255,255,0.04) 25%,
          rgba(255,255,255,0.09) 37%,
          rgba(255,255,255,0.04) 63%
        );
        background-size: 400% 100%;
        animation: skelShimmer 1.3s ease-in-out infinite;
      }
      @keyframes skelShimmer {
        0%   { background-position: 100% 50%; }
        100% { background-position: 0 50%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .skel { animation: none; background: rgba(255,255,255,0.05); }
      }
    `}</style>
  );
}

// A stack of workout cards (Log page)
export function LogSkeleton() {
  return (
    <div>
      <SkeletonStyles />
      <Shimmer className="h-9 w-24 mb-6" />
      <Shimmer className="h-4 w-32 mb-3" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-card border border-line rounded-2xl p-4 mb-3">
          <div className="flex gap-4">
            <Shimmer className="h-12 w-12 shrink-0" />
            <div className="flex-1">
              <Shimmer className="h-4 w-28 mb-2" />
              <Shimmer className="h-3 w-40 mb-1.5" />
              <Shimmer className="h-3 w-32 mb-1.5" />
              <Shimmer className="h-3 w-36" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Routine list (Routines page)
export function ListSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div>
      <SkeletonStyles />
      {title && <Shimmer className="h-9 w-36 mb-5" />}
      <div className="bg-card border border-line rounded-2xl divide-y divide-line">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="p-4">
            <Shimmer className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Exercise cards with set rows (Workout page)
export function WorkoutSkeleton() {
  return (
    <div>
      <SkeletonStyles />
      <div className="flex justify-between items-center mb-5">
        <Shimmer className="h-9 w-24 rounded-full" />
        <Shimmer className="h-5 w-28" />
        <Shimmer className="h-5 w-16" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="bg-card border border-line rounded-2xl p-4 mb-4">
          <Shimmer className="h-5 w-36 mb-3" />
          <Shimmer className="h-9 w-full mb-3" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex gap-2 items-center mb-2">
              <Shimmer className="h-7 w-7 rounded-full shrink-0" />
              <Shimmer className="h-9 flex-1" />
              <Shimmer className="h-9 flex-1" />
              <Shimmer className="h-9 flex-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Stat tiles + chart (Stats page)
export function StatsSkeleton() {
  return (
    <div>
      <SkeletonStyles />
      <Shimmer className="h-9 w-40 mb-5" />
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-card border border-line rounded-2xl p-4">
            <Shimmer className="h-3 w-16 mb-2" />
            <Shimmer className="h-6 w-20" />
          </div>
        ))}
      </div>
      <div className="bg-card border border-line rounded-2xl p-4">
        <Shimmer className="h-3 w-24 mb-4" />
        <Shimmer className="h-40 w-full" />
      </div>
    </div>
  );
}

// Past workout detail
export function DetailSkeleton() {
  return (
    <div>
      <SkeletonStyles />
      <Shimmer className="h-4 w-16 mb-4" />
      <Shimmer className="h-9 w-44 mb-2" />
      <Shimmer className="h-4 w-52 mb-5" />
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-card border border-line rounded-2xl p-3">
            <Shimmer className="h-3 w-12 mb-2 mx-auto" />
            <Shimmer className="h-5 w-14 mx-auto" />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="bg-card border border-line rounded-2xl p-4 mb-4">
          <Shimmer className="h-5 w-32 mb-3" />
          {[0, 1, 2].map((j) => (
            <Shimmer key={j} className="h-6 w-full mb-2" />
          ))}
        </div>
      ))}
    </div>
  );
}
