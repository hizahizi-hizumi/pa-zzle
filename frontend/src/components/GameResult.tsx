import { type ReactNode, useEffect, useRef } from "react";

import type { GameResultLevel } from "@/games/result";

type GameResultStyle = {
  message: string;
  scoreClassName: string;
  panelClassName: string;
  markClassName: string;
  confettiIntensity: "strong" | "light" | null;
};

const gameResultStyles: Record<GameResultLevel, GameResultStyle> = {
  perfect: {
    message: "パーフェクト！",
    scoreClassName: "text-amber-600 dark:text-amber-300",
    panelClassName:
      "border-amber-200 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/30",
    markClassName:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    confettiIntensity: "strong",
  },
  great: {
    message: "すばらしい！",
    scoreClassName: "text-emerald-600 dark:text-emerald-300",
    panelClassName:
      "border-emerald-200 bg-emerald-50/75 dark:border-emerald-900/70 dark:bg-emerald-950/30",
    markClassName:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    confettiIntensity: "light",
  },
  good: {
    message: "ナイスプレイ！",
    scoreClassName: "text-sky-600 dark:text-sky-300",
    panelClassName:
      "border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/30",
    markClassName:
      "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    confettiIntensity: null,
  },
  clear: {
    message: "クリア！",
    scoreClassName: "text-foreground",
    panelClassName: "border-border bg-muted/40",
    markClassName: "bg-muted text-foreground",
    confettiIntensity: null,
  },
};

function getGameResultStyle(level: GameResultLevel): GameResultStyle {
  return gameResultStyles[level];
}

export function GameResultScoreCard({
  score,
  level,
}: {
  score: number;
  level: GameResultLevel;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const style = getGameResultStyle(level);

  useEffect(() => {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      return;
    }

    cardRef.current?.animate?.(
      [
        { transform: "scale(0.94)", opacity: 0 },
        { transform: "scale(1.025)", opacity: 1, offset: 0.72 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 620, easing: "cubic-bezier(.2,.8,.2,1)", delay: 120 },
    );
  }, []);

  return (
    <div
      ref={cardRef}
      className={`mt-6 rounded-3xl border px-5 py-5 text-center shadow-sm ${style.panelClassName}`}
    >
      <p className={`text-sm font-bold tracking-wide ${style.scoreClassName}`}>
        {style.message}
      </p>
      <p className="mt-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        スコア
      </p>
      <p
        className={`mt-1 font-mono text-6xl font-bold tracking-tight tabular-nums ${style.scoreClassName}`}
      >
        {score}
        <span className="ml-1 text-base font-medium text-muted-foreground">
          {" "}
          / 100
        </span>
      </p>
    </div>
  );
}

export function GameResultMark({
  level,
  children,
}: {
  level: GameResultLevel;
  children: ReactNode;
}) {
  const markRef = useRef<HTMLDivElement>(null);
  const style = getGameResultStyle(level);

  useEffect(() => {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      return;
    }

    markRef.current?.animate?.(
      [
        { transform: "scale(0.65) rotate(-8deg)", opacity: 0 },
        { transform: "scale(1.08) rotate(3deg)", opacity: 1, offset: 0.7 },
        { transform: "scale(1) rotate(0deg)", opacity: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }, []);

  return (
    <div
      ref={markRef}
      className={`mx-auto flex size-20 items-center justify-center rounded-full shadow-sm ${style.markClassName}`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

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

export function GameResultConfetti({ level }: { level: GameResultLevel }) {
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
