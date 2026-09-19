import { useEffect, useRef } from "react";

import { GameResultSurface } from "@/components/GameResultSurface";
import { getGameResultStyle } from "@/components/game-result-style";
import type { GameResultLevel } from "@/games/result";

type GameResultScoreCardProps = {
  score: number;
  level: GameResultLevel;
};

export function GameResultScoreCard({
  score,
  level,
}: GameResultScoreCardProps) {
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
    <div ref={cardRef} className="mt-3">
      <GameResultSurface variant={style.surfaceVariant} label="スコア">
        <div className="text-center">
          {style.message && (
            <p
              className={`text-sm font-bold tracking-wide ${style.scoreClassName}`}
            >
              {style.message}
            </p>
          )}
          <p className="mt-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            スコア
          </p>
          <p
            className={`mt-1 font-mono text-5xl font-bold tracking-tight tabular-nums ${style.scoreClassName}`}
          >
            {score}
            <span className="ml-1 text-base font-medium text-muted-foreground">
              {" "}
              / 100
            </span>
          </p>
        </div>
      </GameResultSurface>
    </div>
  );
}
