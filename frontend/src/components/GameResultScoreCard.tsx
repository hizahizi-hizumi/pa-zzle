import { useEffect, useRef } from "react";

import { GameResultSurface } from "@/components/GameResultSurface";
import { getGameResultStyle } from "@/components/game-result-style";
import type { GameResultLevel } from "@/games/result";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

type GameResultScoreCardProps = {
  score: number;
  level: GameResultLevel;
};

const SCORE_REVEAL_MS = 620;
/** 結果の印が出始めてから、スコアを出し始めるまでの間。 */
const SCORE_REVEAL_DELAY_MS = 120;

const scoreRevealKeyframes: Keyframe[] = [
  { transform: "scale(0.94)", opacity: 0 },
  { transform: "scale(1.025)", opacity: 1, offset: 0.72 },
  { transform: "scale(1)", opacity: 1 },
];

export function GameResultScoreCard({
  score,
  level,
}: GameResultScoreCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const style = getGameResultStyle(level);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    cardRef.current?.animate?.(scoreRevealKeyframes, {
      duration: SCORE_REVEAL_MS,
      delay: SCORE_REVEAL_DELAY_MS,
      easing: MOTION_EASING.celebrate,
    });
  }, []);

  return (
    <div ref={cardRef} className="mt-3">
      <GameResultSurface variant={style.surfaceVariant} label="スコア">
        <div className="text-center">
          {style.message && (
            <p
              className={`text-supporting font-bold tracking-wide ${style.scoreClassName}`}
            >
              {style.message}
            </p>
          )}
          <p className="mt-1 text-meta font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            スコア
          </p>
          <p
            className={`mt-1 font-mono text-5xl font-bold tracking-tight tabular-nums ${style.scoreClassName}`}
          >
            {score}
            <span className="ml-1 text-body font-medium text-muted-foreground">
              {" "}
              / 100
            </span>
          </p>
        </div>
      </GameResultSurface>
    </div>
  );
}
