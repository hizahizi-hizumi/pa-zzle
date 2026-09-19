import type { WaterSortResult } from "@/games/water-sort/hooks/use-water-sort-play";
import {
  WATER_SORT_SCORE_MAXIMUMS,
  WATER_SORT_SPEED_INITIAL_RECOGNITION_MS,
  WATER_SORT_SPEED_PER_COLOR_MS,
  WATER_SORT_SPEED_PER_OPTIMAL_MOVE_MS,
} from "@/games/water-sort/score";
import { formatScoreTime } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen/format-score-time";

type ScoreCriteriaProps = {
  result: WaterSortResult;
};

export function ScoreCriteria({ result }: ScoreCriteriaProps) {
  const efficiencyZeroMoveCount = result.optimalMoveCount * 2;
  const speedZeroScoreMs = result.speedFullScoreMs * 2;

  return (
    <dl className="mt-3 grid gap-3 text-xs">
      <div>
        <dt className="font-semibold text-foreground">効率</dt>
        <dd className="mt-0.5">
          最短{result.optimalMoveCount}手で
          {WATER_SORT_SCORE_MAXIMUMS.efficiency}点。
          {efficiencyZeroMoveCount}手以上で0点、その間はクリア手数に応じて減点。
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">速さ</dt>
        <dd className="mt-0.5">
          基準時間{formatScoreTime(result.speedFullScoreMs)}以内で
          {WATER_SORT_SCORE_MAXIMUMS.speed}点。
          {formatScoreTime(speedZeroScoreMs)}
          以上で0点、その間は時間に応じて減点。 基準時間は
          {`${WATER_SORT_SPEED_INITIAL_RECOGNITION_MS / 1000}秒 + ${result.colorCount}色 × ${WATER_SORT_SPEED_PER_COLOR_MS / 1000}秒 + 最短${result.optimalMoveCount}手 × ${WATER_SORT_SPEED_PER_OPTIMAL_MOVE_MS / 1000}秒`}
          。
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">正確性</dt>
        <dd className="mt-0.5">
          手戻りなしで{WATER_SORT_SCORE_MAXIMUMS.accuracy}点。手戻り
          {result.optimalMoveCount}手以上で0点、その間は手戻り数に応じて減点。
        </dd>
      </div>
      <div>
        <dt className="sr-only">丸め</dt>
        <dd>各項目は1点単位に四捨五入し、0点を下限とします。</dd>
      </div>
    </dl>
  );
}
