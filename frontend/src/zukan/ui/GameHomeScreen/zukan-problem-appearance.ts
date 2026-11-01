import { getGameResultStyle } from "@/components/game-result-style";
import { getDifficultyLabel } from "@/games/difficulty";
import {
  getZukanProblemStatus,
  type ZukanProblem,
  type ZukanProblemStatus,
} from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

/** 見方と状態ごとの数に並べる状態。評価段階の高い順に続けて、まだクリアしていない状態を並べる。 */
export const zukanProblemStatusOrder = [
  "perfect",
  "great",
  "good",
  "clear",
  "attempted",
  "untouched",
] as const satisfies readonly ZukanProblemStatus[];

/** 評価段階は仕様の名前のまま示し、結果画面の称賛の言葉は使わない。 */
export const zukanProblemStatusLabels: Record<ZukanProblemStatus, string> = {
  perfect: "perfect",
  great: "great",
  good: "good",
  clear: "clear",
  attempted: "挑戦中",
  untouched: "未挑戦",
};

/**
 * マスと凡例の見本に共通する、状態ごとの塗りと枠。
 * 解いた問題は結果画面と同じ評価段階の色で塗る。未挑戦は塗らずに枠だけにし、挑戦中は枠を強める。
 */
const zukanProblemStatusClassNames: Record<ZukanProblemStatus, string> = {
  perfect: getGameResultStyle("perfect").fillClassName,
  great: getGameResultStyle("great").fillClassName,
  good: getGameResultStyle("good").fillClassName,
  clear: getGameResultStyle("clear").fillClassName,
  attempted:
    "border-(length:--border-width-strong) border-muted-foreground bg-background",
  untouched:
    "border-(length:--border-width-normal) border-border bg-background",
};

export function getZukanProblemStatusClassName(
  status: ZukanProblemStatus,
): string {
  return zukanProblemStatusClassNames[status];
}

/** 図鑑の番号を、問題集の全問の数の桁まで0で埋めて `No.0001` の形で示す。 */
export function formatZukanNumber(number: number, digitCount: number): string {
  return `No.${String(number).padStart(digitCount, "0")}`;
}

/** 全問の数から、図鑑の番号を埋める桁数を求める。 */
export function getZukanNumberDigitCount(problemCount: number): number {
  return String(problemCount).length;
}

const zukanProblemChangeLabels: Record<ZukanProblemChange["kind"], string> = {
  "newly-solved": "前回から新しく解いた",
  raised: "前回から段階が上がった",
};

/** マスの読み上げ名。番号・難易度と、最高スコアか、挑戦中・未挑戦であることを1文で示し、前回図鑑を見たときからの変化があれば添える。 */
export function describeZukanProblem(
  problem: ZukanProblem,
  digitCount: number,
  change: ZukanProblemChange | null = null,
): string {
  const heading = `${formatZukanNumber(problem.number, digitCount)} ${getDifficultyLabel(problem.difficulty)}`;
  const status =
    problem.kind === "solved"
      ? `最高スコア${problem.bestScore}点`
      : zukanProblemStatusLabels[getZukanProblemStatus(problem)];
  return change === null
    ? `${heading} ${status}`
    : `${heading} ${status} ${zukanProblemChangeLabels[change.kind]}`;
}
