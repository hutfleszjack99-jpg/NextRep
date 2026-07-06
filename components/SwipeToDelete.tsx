"use client";
import { useRef, useState } from "react";

// Wraps a row. Swipe left to reveal a Delete button; tap it to confirm-delete.
export default function SwipeToDelete({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0); // negative = revealed
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const REVEAL = -84;

  const begin = (x: number) => {
    startX.current = x;
    startOffset.current = offset;
  };
  const move = (x: number) => {
    if (startX.current === null) return;
    const dx = x - startX.current;
    let next = startOffset.current + dx;
    if (next > 0) next = 0;
    if (next < REVEAL - 20) next = REVEAL - 20;
    setOffset(next);
  };
  const end = () => {
    if (startX.current === null) return;
    startX.current = null;
    setOffset(offset < REVEAL / 2 ? REVEAL : 0);
  };

  return (
    <div className="relative overflow-hidden">
      {/* delete action behind the row */}
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          onClick={onDelete}
          className="bg-danger text-white font-semibold px-5 text-sm"
          style={{ width: -REVEAL }}
        >
          Delete
        </button>
      </div>
      <div
        className="relative bg-card"
        style={{ transform: `translateX(${offset}px)`, transition: startX.current === null ? "transform .18s ease" : "none", touchAction: "pan-y" }}
        onTouchStart={(e) => begin(e.touches[0].clientX)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={end}
        onMouseDown={(e) => begin(e.clientX)}
        onMouseMove={(e) => startX.current !== null && move(e.clientX)}
        onMouseUp={end}
        onMouseLeave={end}
      >
        {children}
      </div>
    </div>
  );
}
