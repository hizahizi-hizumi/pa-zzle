import type { SlidePuzzleResult } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import {
  SLIDE_PUZZLE_SCORE_MAXIMUMS,
  SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS,
  slidePuzzleSpeedInitialRecognitionMsByBoardSize,
} from "@/games/slide-puzzle/score";
import { formatElapsedTimeWithTenths } from "@/lib/format-elapsed-time";

export function getSlidePuzzleScoreCriteria(result: SlidePuzzleResult) {
  const efficiencyHalfMoveCount = result.optimalMoveCount * 2;
  const speedZeroScoreMs = result.speedFullScoreMs * 2;

  return {
    items: [
      {
        label: "効率",
        description: (
          <>
            最短{result.optimalMoveCount}手で
            {SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency}点。
            総手数に対する最短手数の割合で配点し、{efficiencyHalfMoveCount}
            手で{SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency / 2}
            点。総手数には盤面を戻す前の手も含みます。
          </>
        ),
      },
      {
        label: "速さ",
        description: (
          <>
            基準時間{formatElapsedTimeWithTenths(result.speedFullScoreMs)}以内で
            {SLIDE_PUZZLE_SCORE_MAXIMUMS.speed}点。
            {formatElapsedTimeWithTenths(speedZeroScoreMs)}
            以上で0点、その間は時間に応じて減点。基準時間は
            {`盤面把握${slidePuzzleSpeedInitialRecognitionMsByBoardSize[result.boardSize] / 1000}秒 + 最短${result.optimalMoveCount}手 × ${SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS / 1000}秒`}
            。
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
