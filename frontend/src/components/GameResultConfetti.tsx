import { useEffect, useRef } from "react";

import { getGameResultStyle } from "@/components/game-result-style";
import type { GameResultLevel } from "@/games/result";

const confettiPieces = [
  [-130, -170, -210, "#f59e0b"],
  [-100, -125, 170, "#10b981"],
  [-72, -190, -120, "#38bdf8"],
  [-44, -145, 260, "#f472b6"],
  [-18, -205, -180, "#a78bfa"],
  [16, -178, 220, "#facc15"],
  [44, -212, -250, "#34d399"],
  [72, -150, 180, "#60a5fa"],
  [104, -188, -160, "#fb7185"],
  [136, -132, 240, "#f59e0b"],
  [-150, -82, 180, "#22c55e"],
  [-112, -58, -230, "#38bdf8"],
  [-76, -96, 140, "#f472b6"],
  [-38, -68, 250, "#facc15"],
  [0, -102, -190, "#a78bfa"],
  [40, -72, 210, "#34d399"],
  [78, -108, -150, "#fb7185"],
  [116, -64, 260, "#60a5fa"],
  [150, -94, -220, "#f59e0b"],
  [-126, -218, 160, "#f472b6"],
  [-56, -238, -250, "#38bdf8"],
  [28, -242, 210, "#facc15"],
  [92, -224, -170, "#22c55e"],
  [154, -196, 240, "#a78bfa"],
] as const;

type GameResultConfettiProps = {
  level: GameResultLevel;
};

export function GameResultConfetti({ level }: GameResultConfettiProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const intensity = getGameResultStyle(level).confettiIntensity;

  useEffect(() => {
    if (!intensity) {
      return;
    }

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      return;
    }

    const pieces = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(
        "[data-confetti-piece]",
      ) ?? [],
    );

    for (const [index, piece] of pieces.entries()) {
      const [x, y, rotation] = confettiPieces[index] ?? [0, -100, 180];
      piece.animate?.(
        [
          { transform: "translate(0, 0) scale(0.35)", opacity: 0 },
          {
            transform: "translate(0, -12px) scale(1)",
            opacity: 1,
            offset: 0.1,
          },
          {
            transform: `translate(${x * 0.78}px, ${y * 0.78}px) rotate(${rotation * 0.78}deg) scale(1)`,
            opacity: 1,
            offset: 0.72,
          },
          {
            transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(0.85)`,
            opacity: 0,
          },
        ],
        {
          duration: 1350 + (index % 4) * 100,
          delay: 90 + (index % 6) * 34,
          easing: "cubic-bezier(.2,.7,.2,1)",
        },
      );
    }
  }, [intensity]);

  if (!intensity) {
    return null;
  }

  const pieceCount = intensity === "strong" ? 24 : 12;
  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      aria-hidden="true"
    >
      {confettiPieces.slice(0, pieceCount).map(([x, y, rotation, color]) => (
        <span
          key={`${x}-${y}-${rotation}`}
          data-confetti-piece
          className="absolute left-1/2 top-[38%] h-3 w-1.5 rounded-sm opacity-0"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
