import type { MinesweeperResult } from "@/games/minesweeper/play/use-minesweeper-play";
import {
  MINESWEEPER_MISTAKE_PENALTY,
  MINESWEEPER_SCORE_MAXIMUMS,
  MINESWEEPER_SPEED_INITIAL_RECOGNITION_MS,
  MINESWEEPER_SPEED_PER_MINE_MS,
  MINESWEEPER_SPEED_PER_MINIMUM_OPEN_MS,
} from "@/games/minesweeper/score";
import { formatElapsedTime } from "@/games/minesweeper/ui/format-elapsed-time";

type ScoreCriteriaProps = {
  result: MinesweeperResult;
};

export function ScoreCriteria({ result }: ScoreCriteriaProps) {
  const speedZeroScoreMs = result.speedFullScoreMs * 2;

  return (
    <dl className="mt-3 grid gap-3 text-meta">
      <div>
        <dt className="font-semibold text-foreground">正確性</dt>
        <dd className="mt-1">
          地雷を踏まずに{MINESWEEPER_SCORE_MAXIMUMS.accuracy}
          点。踏んだ地雷1つにつき
          {MINESWEEPER_MISTAKE_PENALTY}点減点。
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">速さ</dt>
        <dd className="mt-1">
          基準時間{formatElapsedTime(result.speedFullScoreMs)}以内で
          {MINESWEEPER_SCORE_MAXIMUMS.speed}点。
          {formatElapsedTime(speedZeroScoreMs)}
          以上で0点、その間は時間に応じて減点。 基準時間は
          {`${MINESWEEPER_SPEED_INITIAL_RECOGNITION_MS / 1000}秒 + 開く操作の最小${result.minimumOpenCount}回 × ${MINESWEEPER_SPEED_PER_MINIMUM_OPEN_MS / 1000}秒 + 地雷${result.mineCount}個 × ${MINESWEEPER_SPEED_PER_MINE_MS / 1000}秒`}
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
