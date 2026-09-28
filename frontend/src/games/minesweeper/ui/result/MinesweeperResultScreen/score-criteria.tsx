import type { MinesweeperResult } from "@/games/minesweeper/play/use-minesweeper-play";
import {
  MINESWEEPER_MISTAKE_PENALTY,
  MINESWEEPER_SCORE_MAXIMUMS,
  MINESWEEPER_SPEED_INITIAL_RECOGNITION_MS,
  MINESWEEPER_SPEED_PER_MINE_MS,
  MINESWEEPER_SPEED_PER_MINIMUM_OPEN_MS,
} from "@/games/minesweeper/score";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

export function getMinesweeperScoreCriteria(result: MinesweeperResult) {
  const speedZeroScoreMs = result.speedFullScoreMs * 2;

  return {
    items: [
      {
        label: "正確性",
        description: (
          <>
            地雷を踏まずに{MINESWEEPER_SCORE_MAXIMUMS.accuracy}
            点。踏んだ地雷1つにつき
            {MINESWEEPER_MISTAKE_PENALTY}点減点。
          </>
        ),
      },
      {
        label: "速さ",
        description: (
          <>
            基準時間{formatElapsedTime(result.speedFullScoreMs)}以内で
            {MINESWEEPER_SCORE_MAXIMUMS.speed}点。
            {formatElapsedTime(speedZeroScoreMs)}
            以上で0点、その間は時間に応じて減点。 基準時間は
            {`${MINESWEEPER_SPEED_INITIAL_RECOGNITION_MS / 1000}秒 + 開く操作の最小${result.minimumOpenCount}回 × ${MINESWEEPER_SPEED_PER_MINIMUM_OPEN_MS / 1000}秒 + 地雷${result.mineCount}個 × ${MINESWEEPER_SPEED_PER_MINE_MS / 1000}秒`}
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
