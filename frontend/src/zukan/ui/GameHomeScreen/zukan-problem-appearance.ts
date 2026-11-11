import { getGameResultStyle } from "@/components/game-result-style";
import { getDifficultyLabel } from "@/games/difficulty";
import { formatZukanNumber } from "@/zukan/ui/zukan-number-format";
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
 * マスと凡例の見本に共通する、状態ごとの塗りの色。文字色として与え、面は `currentColor` で塗る。
 * 解いた問題は結果画面と同じ評価段階の色で塗る。台に置いたピースとして見せる。
 * 未挑戦は台の凹みの色で、挑戦中は台より明るい色で塗り、手を付けたことだけを示す。
 * 色は、ゲームの地の色（ブラウザ周辺の色へつなげるための `--browser-surface`）から作る。
 */
const zukanProblemStatusColorClassNames: Record<ZukanProblemStatus, string> = {
  perfect: getGameResultStyle("perfect").fillColorClassName,
  great: getGameResultStyle("great").fillColorClassName,
  good: getGameResultStyle("good").fillColorClassName,
  clear: getGameResultStyle("clear").fillColorClassName,
  attempted:
    "text-[color-mix(in_oklab,var(--browser-surface,oklch(0.92_0_0))_55%,var(--card))]",
  untouched:
    "text-(--zukan-recess,color-mix(in_oklab,var(--browser-surface,oklch(0.92_0_0))_85%,var(--foreground)))",
};

/** 台に置いたピースとして描く状態か。解いた問題だけを置く。 */
export function isZukanPlacedStatus(status: ZukanProblemStatus): boolean {
  return status !== "attempted" && status !== "untouched";
}

/** 置いたピースの面に重ねる、左上からの照りのグラデーション。台紙が一度だけ定義し、各ピースが参照する。 */
export const ZUKAN_PIECE_SHEEN_ID = "zukan-piece-sheen";
/** 空きの凹みに落ちる影の勾配の id。台紙が1つだけ定義し、空きのピースが参照する。 */
export const ZUKAN_PIECE_RECESS_ID = "zukan-piece-recess";

export function getZukanProblemStatusColorClassName(
  status: ZukanProblemStatus,
): string {
  return zukanProblemStatusColorClassNames[status];
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
