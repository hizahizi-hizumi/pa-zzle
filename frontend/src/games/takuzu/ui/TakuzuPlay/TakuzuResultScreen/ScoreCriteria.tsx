import type { TakuzuResult } from "@/games/takuzu/play/use-takuzu-play";
import {
  TAKUZU_CORRECTION_PENALTY,
  TAKUZU_RESTART_PENALTY,
  TAKUZU_SCORE_MAXIMUMS,
  TAKUZU_SPEED_INITIAL_RECOGNITION_MS,
  TAKUZU_SPEED_PER_EMPTY_CELL_MS,
  TAKUZU_SPEED_PER_LINE_READING_ROUND_MS,
  TAKUZU_SPEED_PER_ROUND_MS,
} from "@/games/takuzu/score";
import { formatTakuzuElapsedTime } from "@/games/takuzu/ui/format-elapsed-time";

type ScoreCriteriaProps = {
  result: TakuzuResult;
};

function formatSeconds(milliseconds: number): string {
  return `${milliseconds / 1_000}秒`;
}

export function ScoreCriteria({ result }: ScoreCriteriaProps) {
  const { workload, speedFullScoreMs } = result;
  const speedZeroScoreMs = speedFullScoreMs * 2;

  return (
    <dl className="mt-3 grid gap-3 text-meta">
      <div>
        <dt className="font-semibold text-foreground">正確さ</dt>
        <dd className="mt-1">
          置き直しも盤面を戻すこともなければ{TAKUZU_SCORE_MAXIMUMS.accuracy}
          点。置き直し1回につき{TAKUZU_CORRECTION_PENALTY}
          点、盤面を戻すと1回につき{TAKUZU_RESTART_PENALTY}点減点。
          置き直しは、一度置いたタイルを後から別のタイルや空きに変えた回数で、空きマスを続けて押してタイルを選ぶ間は数えません。
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">速さ</dt>
        <dd className="mt-1">
          基準時間{formatTakuzuElapsedTime(speedFullScoreMs)}以内で
          {TAKUZU_SCORE_MAXIMUMS.speed}点。
          {formatTakuzuElapsedTime(speedZeroScoreMs)}
          以上で0点、その間は時間に応じて減点。基準時間は
          {`${formatSeconds(TAKUZU_SPEED_INITIAL_RECOGNITION_MS)} + 空きマス${workload.emptyCellCount} × ${formatSeconds(TAKUZU_SPEED_PER_EMPTY_CELL_MS)} + 探し直し${workload.roundCount}回 × ${formatSeconds(TAKUZU_SPEED_PER_ROUND_MS)} + 行・列全体の読み${workload.lineReadingRoundCount}回 × ${formatSeconds(TAKUZU_SPEED_PER_LINE_READING_ROUND_MS)}`}
          。探し直しと行・列全体の読みは、この問題を推測なしに解くときに要る回数です。
        </dd>
      </div>
      <div>
        <dt className="sr-only">丸め</dt>
        <dd>速さは1点単位に四捨五入し、各項目は0点を下限とします。</dd>
      </div>
    </dl>
  );
}
