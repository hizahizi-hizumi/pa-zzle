import type { SlidePuzzleResult } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import {
  SLIDE_PUZZLE_SCORE_MAXIMUMS,
  SLIDE_PUZZLE_SPEED_INITIAL_RECOGNITION_MS,
  SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS,
} from "@/games/slide-puzzle/score";
import { formatScoreTime } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/SlidePuzzleResultScreen/format-score-time";

type ScoreCriteriaProps = {
  result: SlidePuzzleResult;
};

export function ScoreCriteria({ result }: ScoreCriteriaProps) {
  const efficiencyHalfMoveCount = result.optimalMoveCount * 2;
  const speedZeroScoreMs = result.speedFullScoreMs * 2;

  return (
    <dl className="mt-3 grid gap-3 text-meta">
      <div>
        <dt className="font-semibold text-foreground">効率</dt>
        <dd className="mt-1">
          最短{result.optimalMoveCount}手で
          {SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency}点。
          総手数に対する最短手数の割合で配点し、{efficiencyHalfMoveCount}
          手で{SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency / 2}
          点。総手数には盤面を戻す前の手も含みます。
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">速さ</dt>
        <dd className="mt-1">
          基準時間{formatScoreTime(result.speedFullScoreMs)}以内で
          {SLIDE_PUZZLE_SCORE_MAXIMUMS.speed}点。
          {formatScoreTime(speedZeroScoreMs)}
          以上で0点、その間は時間に応じて減点。基準時間は
          {`${SLIDE_PUZZLE_SPEED_INITIAL_RECOGNITION_MS / 1000}秒 + 最短${result.optimalMoveCount}手 × ${SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS / 1000}秒`}
          。
        </dd>
      </div>
      <div>
        <dt className="sr-only">丸め</dt>
        <dd>各項目は1点単位に四捨五入し、0点を下限とします。</dd>
      </div>
    </dl>
  );
}
