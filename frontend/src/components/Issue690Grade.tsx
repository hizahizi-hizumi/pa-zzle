import { useEffect, useState } from "react";
import { getGameResultStyle } from "@/components/game-result-style";
import type { GameResultLevel } from "@/games/result";
import {
  prefersReducedMotion,
  subscribePrefersReducedMotion,
} from "@/lib/motion";

type Issue690GradeProps = {
  level: GameResultLevel;
  score: number;
  compact?: boolean;
  countUp?: boolean;
};

const SCORE_REVEAL_DELAY_MS = 340;
const SCORE_REVEAL_DURATION_MS = 1100;

export function Issue690Grade({
  level,
  score,
  compact = false,
  countUp = false,
}: Issue690GradeProps) {
  const message = getGameResultStyle(level).message ?? "クリア！";
  const [displayScore, setDisplayScore] = useState(() =>
    countUp && !prefersReducedMotion() ? 0 : score,
  );

  useEffect(() => {
    if (!countUp || prefersReducedMotion()) return;
    let frame = 0;
    let elapsedStart: number | undefined;
    function animate(now: number) {
      elapsedStart ??= now;
      const progress = Math.min(
        1,
        Math.max(0, now - elapsedStart - SCORE_REVEAL_DELAY_MS) /
          SCORE_REVEAL_DURATION_MS,
      );
      const eased = 1 - (1 - progress) ** 3;
      setDisplayScore(Math.round(score * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    }
    frame = window.requestAnimationFrame(animate);
    const unsubscribe = subscribePrefersReducedMotion(() => {
      if (!prefersReducedMotion()) return;
      window.cancelAnimationFrame(frame);
      setDisplayScore(score);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [score, countUp]);

  return (
    <div className={`i690-grade ${compact ? "i690-grade--compact" : ""}`}>
      <strong className="i690-grade-name">{message}</strong>
      <div className="i690-grade-score">
        {countUp && <span className="sr-only">{score}点（100点満点）</span>}
        <b aria-hidden={countUp}>{countUp ? displayScore : score}</b>
        <small aria-hidden={countUp}>/ 100</small>
      </div>
    </div>
  );
}
