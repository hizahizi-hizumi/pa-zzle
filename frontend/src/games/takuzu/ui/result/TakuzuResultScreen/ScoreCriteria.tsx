import type { TakuzuResult } from "@/games/takuzu/play/use-takuzu-play";
import {
  TAKUZU_CORRECTION_PENALTY,
  TAKUZU_RESTART_PENALTY,
  TAKUZU_SCORE_MAXIMUMS,
  TAKUZU_SPEED_INITIAL_RECOGNITION_MS,
  TAKUZU_SPEED_PER_EMPTY_CELL_MS,
  TAKUZU_SPEED_PER_LINE_READING_ROUND_MS,
  TAKUZU_SPEED_PER_ROUND_MS,
  TAKUZU_UNDO_PENALTY,
} from "@/games/takuzu/score";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type ScoreCriteriaProps = {
  result: TakuzuResult;
};

function formatSeconds(milliseconds: number): string {
  return `${milliseconds / 1_000}秒`;
}

/** 基準時間の式。その問題で0回の項は省く。 */
function formatSpeedFullScoreFormula({
  emptyCellCount,
  roundCount,
  lineReadingRoundCount,
}: TakuzuResult["workload"]): string {
  const terms = [
    formatSeconds(TAKUZU_SPEED_INITIAL_RECOGNITION_MS),
    `空きマス${emptyCellCount} × ${formatSeconds(TAKUZU_SPEED_PER_EMPTY_CELL_MS)}`,
    `確定マスを探す局面${roundCount}回 × ${formatSeconds(TAKUZU_SPEED_PER_ROUND_MS)}`,
  ];
  if (lineReadingRoundCount > 0) {
    terms.push(
      `行・列を読む局面${lineReadingRoundCount}回 × ${formatSeconds(TAKUZU_SPEED_PER_LINE_READING_ROUND_MS)}`,
    );
  }
  return terms.join(" + ");
}

export function ScoreCriteria({ result }: ScoreCriteriaProps) {
  const { workload, speedFullScoreMs, speedZeroScoreMs } = result;

  return (
    <dl className="grid gap-3 text-meta">
      <div>
        <dt className="font-semibold text-foreground">正確性</dt>
        <dd className="mt-1">
          {`置き直し1回につき${TAKUZU_CORRECTION_PENALTY}点、盤面戻し1回につき${TAKUZU_RESTART_PENALTY}点、待った1回につき${TAKUZU_UNDO_PENALTY}点を減点（満点${TAKUZU_SCORE_MAXIMUMS.accuracy}点）。置き直しは、一度置いたタイルを別のマスへ移ってから変えた回数で、続けて押してタイルを選ぶ間と、待ったで取り消した操作は数えません。盤面戻しは、メニューの「盤面を戻す」を使った回数です。`}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">速さ</dt>
        <dd className="mt-1">
          {`基準時間${formatElapsedTime(speedFullScoreMs)}以内で${TAKUZU_SCORE_MAXIMUMS.speed}点、${formatElapsedTime(speedZeroScoreMs)}以上で0点、その間は時間に応じて減点。基準時間は${formatSpeedFullScoreFormula(workload)}。局面の数は、この問題を推測なしに解くときに要る回数で、最初に探す1回も含みます。`}
        </dd>
      </div>
      <div>
        <dt className="sr-only">丸め</dt>
        <dd>速さは1点単位に四捨五入し、各項目は0点を下限とします。</dd>
      </div>
    </dl>
  );
}
