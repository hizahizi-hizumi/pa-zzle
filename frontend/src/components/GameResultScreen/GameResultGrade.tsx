import { Award } from "lucide-react";
import { useEffect, useState } from "react";
import { getGameResultStyle } from "@/components/game-result-style";
import type { ResultRecordImprovement } from "@/games/play";
import type { GameResultLevel } from "@/games/result";
import {
  prefersReducedMotion,
  subscribePrefersReducedMotion,
} from "@/lib/motion";

type GameResultGradeProps = {
  level: GameResultLevel;
  score: number;
  countUp?: boolean;
  improvement?: ResultRecordImprovement;
  feats?: readonly string[];
};

const SCORE_REVEAL_DELAY_MS = 340;
const SCORE_REVEAL_DURATION_MS = 1100;

export function GameResultGrade({
  level,
  score,
  countUp = false,
  improvement,
  feats = [],
}: GameResultGradeProps) {
  const { message, markClassName } = getGameResultStyle(level);
  const [displayScore, setDisplayScore] = useState(() =>
    countUp && !prefersReducedMotion() ? 0 : score,
  );

  useEffect(() => {
    if (!countUp || prefersReducedMotion()) {
      setDisplayScore(score);
      return;
    }
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
    <div className="result-grade" role="region" aria-label="スコア">
      <strong className="result-grade-name">{message}</strong>
      <p className="result-grade-tags">
        <span className={`result-grade-level ${markClassName}`}>
          <span className="sr-only">評価 </span>
          {level}
        </span>
        {feats.map((feat) => (
          <span key={feat} className="result-grade-feat">
            {feat}
          </span>
        ))}
      </p>
      <div className="result-grade-score">
        {countUp && <span className="sr-only">{score}点（100点満点）</span>}
        <b aria-hidden={countUp}>{countUp ? displayScore : score}</b>
        <small aria-hidden={countUp}>/ 100</small>
      </div>
      <div className="result-grade-progress" aria-hidden="true">
        <span
          className="result-grade-progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
        <span className="result-grade-progress-end" />
      </div>
      {improvement && (
        <span
          className="result-grade-best"
          title={`スコア：${improvement.previous}から${improvement.current}へ`}
          aria-label={`スコアの自己ベスト更新：${improvement.previous}から${improvement.current}、${improvement.improvement}`}
        >
          <Award aria-hidden="true" />
          <strong aria-hidden="true">{improvement.improvement}</strong>
        </span>
      )}
    </div>
  );
}
