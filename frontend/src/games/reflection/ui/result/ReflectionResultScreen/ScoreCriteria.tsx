import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import {
  REFLECTION_RELOCATION_PENALTY,
  REFLECTION_RESTART_PENALTY,
  REFLECTION_SCORE_MAXIMUMS,
  REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT,
  REFLECTION_SPEED_PER_ASSUMPTION_TEST_MS,
  REFLECTION_SPEED_PER_CLUE_MS,
  REFLECTION_SPEED_PER_PIECE_MS,
  REFLECTION_SPEED_PER_PROPAGATION_ROUND_MS,
} from "@/games/reflection/score";
import { formatElapsedTime } from "@/games/reflection/ui/format-elapsed-time";

type ScoreCriteriaProps = {
  result: ReflectionResult;
};

function formatSeconds(milliseconds: number): string {
  return `${milliseconds / 1_000}秒`;
}

/** 基準時間の式。その問題で0回の項は省く。仮に置いて確かめる回数は上限で打ち切った値を示す。 */
function formatSpeedFullScoreFormula({
  clueCount,
  pieceCount,
  propagationRoundCount,
  assumptionTestCount,
}: ReflectionResult["workload"]): string {
  const terms = [
    `外周ヒント${clueCount}本 × ${formatSeconds(REFLECTION_SPEED_PER_CLUE_MS)}`,
    `ピース${pieceCount}個 × ${formatSeconds(REFLECTION_SPEED_PER_PIECE_MS)}`,
  ];
  if (propagationRoundCount > 0) {
    terms.push(
      `照らし直す局面${propagationRoundCount}回 × ${formatSeconds(REFLECTION_SPEED_PER_PROPAGATION_ROUND_MS)}`,
    );
  }
  if (assumptionTestCount > 0) {
    terms.push(
      `仮に置いて確かめる${Math.min(assumptionTestCount, REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT)}回 × ${formatSeconds(REFLECTION_SPEED_PER_ASSUMPTION_TEST_MS)}`,
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
          {`置き直し1回につき${REFLECTION_RELOCATION_PENALTY}点、盤面戻し1回につき${REFLECTION_RESTART_PENALTY}点を減点（満点${REFLECTION_SCORE_MAXIMUMS.accuracy}点）。置き直しは、置いたピースを別のマスへ移す・入れ替える・ストックへ戻す・別の種類で置き換えた回数です。盤面戻しは、メニューの「盤面を戻す」を使った回数です。光路を確かめた回数は点に入りません。`}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">速さ</dt>
        <dd className="mt-1">
          {`基準時間${formatElapsedTime(speedFullScoreMs)}以内で${REFLECTION_SCORE_MAXIMUMS.speed}点、${formatElapsedTime(speedZeroScoreMs)}以上で0点、その間は時間に応じて減点。基準時間は${formatSpeedFullScoreFormula(workload)}。局面と仮に置く回数は、この問題を外周ヒントから読んで解くときに要る回数です（仮に置く回数は${REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT}回まで数えます）。`}
        </dd>
      </div>
      <div>
        <dt className="sr-only">丸め</dt>
        <dd>速さは1点単位に四捨五入し、各項目は0点を下限とします。</dd>
      </div>
    </dl>
  );
}
