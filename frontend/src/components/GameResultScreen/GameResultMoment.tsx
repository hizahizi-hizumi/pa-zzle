import { GameResultGrade } from "@/components/GameResultScreen/GameResultGrade";
import type { ResultRecordImprovement } from "@/games/play";
import type { GameResultLevel } from "@/games/result";

type GameResultMomentProps = {
  level: GameResultLevel;
  score: number;
  skipReveal: boolean;
  improvement?: ResultRecordImprovement;
};

export function GameResultMoment({
  level,
  score,
  skipReveal,
  improvement,
}: GameResultMomentProps) {
  return (
    <div className="result-theater">
      <div className="result-ambient-daybreak" aria-hidden="true" />
      <div className="result-ambient-veil" aria-hidden="true" />
      <span
        className="result-ambient-pulse result-ambient-pulse--first"
        aria-hidden="true"
      />
      <span
        className="result-ambient-pulse result-ambient-pulse--second"
        aria-hidden="true"
      />
      <GameResultGrade
        level={level}
        score={score}
        countUp={!skipReveal}
        improvement={improvement}
      />
    </div>
  );
}
