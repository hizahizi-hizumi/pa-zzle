import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import {
  calculateReflectionReadingMs,
  calculateReflectionTrialMs,
  REFLECTION_SCORE_MAXIMUM,
  REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT,
  REFLECTION_SPEED_PER_ASSUMPTION_TEST_MS,
  REFLECTION_SPEED_PER_CLUE_MS,
  REFLECTION_SPEED_PER_PIECE_MS,
  REFLECTION_SPEED_PER_PROPAGATION_ROUND_MS,
  REFLECTION_SPEED_PER_TRIAL_MOVE_MS,
} from "@/games/reflection/score";
import { formatElapsedTime } from "@/games/reflection/ui/format-elapsed-time";

type ScoreCriteriaProps = {
  result: ReflectionResult;
};

function formatSeconds(milliseconds: number): string {
  return `${milliseconds / 1_000}秒`;
}

/** 読んで解く時間の式。その問題で0回の項は省く。仮に置いて確かめる回数は上限で打ち切った値を示す。 */
function formatReadingFormula({
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

/** 基準時間の決め方。試し置きの方が速い問題では、読む時間と試し置きの時間の中間になる。 */
function formatSpeedFullScoreRule(
  workload: ReflectionResult["workload"],
): string {
  const readingMs = calculateReflectionReadingMs(workload);
  const reading = `読んで解く時間${formatElapsedTime(readingMs)}（${formatReadingFormula(workload)}）`;
  const trialMs = calculateReflectionTrialMs(workload);
  if (workload.trialMoveCount === null || trialMs >= readingMs) {
    return `${reading}です`;
  }
  const trial = `一致表示を見ながら試し置きで解く時間${formatElapsedTime(trialMs)}（外周ヒント${workload.clueCount}本 × ${formatSeconds(REFLECTION_SPEED_PER_CLUE_MS)} + 試し置き${workload.trialMoveCount}手 × ${formatSeconds(REFLECTION_SPEED_PER_TRIAL_MOVE_MS)}）`;
  return `${reading}と、${trial}の中間です`;
}

export function ScoreCriteria({ result }: ScoreCriteriaProps) {
  const { workload, speedFullScoreMs, speedZeroScoreMs } = result;

  return (
    <dl className="grid gap-3 text-meta">
      <div>
        <dt className="font-semibold text-foreground">速さ</dt>
        <dd className="mt-1">
          {`基準時間${formatElapsedTime(speedFullScoreMs)}以内で${REFLECTION_SCORE_MAXIMUM}点、${formatElapsedTime(speedZeroScoreMs)}以上で0点、その間は時間に応じて減点。基準時間は${formatSpeedFullScoreRule(workload)}。局面と仮に置く回数は、この問題を外周ヒントから読んで解くときに要る回数です（仮に置く回数は${REFLECTION_SPEED_ASSUMPTION_TEST_LIMIT}回まで数えます）。`}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">点に入らないもの</dt>
        <dd className="mt-1">
          置き直し・盤面戻し・光路を確かめた回数は点に入りません。置いて確かめ、動かして直しても減点しません。
        </dd>
      </div>
      <div>
        <dt className="sr-only">丸め</dt>
        <dd>1点単位に四捨五入します。</dd>
      </div>
    </dl>
  );
}
