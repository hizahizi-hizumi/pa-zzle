import { getGameResultStyle } from "@/components/game-result-style";
import { getDifficultyLabel } from "@/games/difficulty";
import { formatZukanNumber } from "@/zukan/ui/zukan-number-format";
import {
  getZukanProblemStatus,
  type ZukanProblem,
  type ZukanProblemStatus,
} from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

export const zukanProblemStatusOrder = [
  "perfect",
  "great",
  "good",
  "clear",
  "attempted",
  "untouched",
] as const satisfies readonly ZukanProblemStatus[];

export const zukanProblemStatusLabels: Record<ZukanProblemStatus, string> = {
  perfect: "perfect",
  great: "great",
  good: "good",
  clear: "clear",
  attempted: "挑戦中",
  untouched: "未挑戦",
};

/**
 * 文字色として与え、面は `currentColor` で塗る。
 * 未挑戦と挑戦中を枠で示すと、ピースの輪郭が台紙一面に線の模様を作って騒がしく、白抜きのピースが穴のように浮くので、塗りの濃さで分ける。
 */
const zukanProblemStatusColorClassNames: Record<ZukanProblemStatus, string> = {
  perfect: getGameResultStyle("perfect").fillColorClassName,
  great: getGameResultStyle("great").fillColorClassName,
  good: getGameResultStyle("good").fillColorClassName,
  clear: getGameResultStyle("clear").fillColorClassName,
  attempted: "text-[oklch(0.86_0_0)] dark:text-[oklch(0.36_0_0)]",
  untouched: "text-[oklch(0.95_0_0)] dark:text-[oklch(0.23_0_0)]",
};

export function getZukanProblemStatusColorClassName(
  status: ZukanProblemStatus,
): string {
  return zukanProblemStatusColorClassNames[status];
}

const zukanProblemChangeLabels: Record<ZukanProblemChange["kind"], string> = {
  "newly-solved": "前回から新しく解いた",
  raised: "前回から段階が上がった",
};

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
