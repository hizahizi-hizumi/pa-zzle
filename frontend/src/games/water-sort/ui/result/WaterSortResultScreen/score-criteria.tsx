import type { WaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import {
  WATER_SORT_SCORE_MAXIMUMS,
  WATER_SORT_SPEED_INITIAL_RECOGNITION_MS,
  WATER_SORT_SPEED_PER_COLOR_MS,
  WATER_SORT_SPEED_PER_OPTIMAL_MOVE_MS,
} from "@/games/water-sort/score";
import { formatElapsedTimeWithTenths } from "@/lib/format-elapsed-time";

export function getWaterSortScoreCriteria(result: WaterSortResult) {
  const efficiencyZeroMoveCount = result.optimalMoveCount * 2;
  const speedZeroScoreMs = result.speedFullScoreMs * 2;

  return {
    items: [
      {
        label: "効率",
        description: (
          <>
            最短{result.optimalMoveCount}手で
            {WATER_SORT_SCORE_MAXIMUMS.efficiency}点。
            {efficiencyZeroMoveCount}
            手以上で0点、その間はクリア手数に応じて減点。
          </>
        ),
      },
      {
        label: "速さ",
        description: (
          <>
            基準時間{formatElapsedTimeWithTenths(result.speedFullScoreMs)}以内で
            {WATER_SORT_SCORE_MAXIMUMS.speed}点。
            {formatElapsedTimeWithTenths(speedZeroScoreMs)}
            以上で0点、その間は時間に応じて減点。 基準時間は
            {`${WATER_SORT_SPEED_INITIAL_RECOGNITION_MS / 1000}秒 + ${result.colorCount}色 × ${WATER_SORT_SPEED_PER_COLOR_MS / 1000}秒 + 最短${result.optimalMoveCount}手 × ${WATER_SORT_SPEED_PER_OPTIMAL_MOVE_MS / 1000}秒`}
            。
          </>
        ),
      },
      {
        label: "正確性",
        description: (
          <>
            手戻りなしで{WATER_SORT_SCORE_MAXIMUMS.accuracy}点。手戻り
            {result.optimalMoveCount}手以上で0点、その間は手戻り数に応じて減点。
          </>
        ),
      },
    ],
    note: {
      label: "丸め",
      description: "各項目は1点単位に四捨五入し、0点を下限とします。",
    },
  };
}
