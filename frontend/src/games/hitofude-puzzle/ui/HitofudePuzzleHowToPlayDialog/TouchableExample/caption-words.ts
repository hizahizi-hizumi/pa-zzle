import type { HowToPlayVerdictLabels } from "@/components/HowToPlayVerdict";
import type { HitofudePuzzleExtensionRejection } from "@/games/hitofude-puzzle/puzzle/transitions";

/** 弾かれたときの言葉。「✕ 通れない」の下に理由を添える。 */
export const blockedLabels: HowToPlayVerdictLabels = {
  allowed: "通れる",
  disallowed: "通れない",
};

/** 弾かれたときに、判定の下に添える理由。例が教えるルールの理由（穴）も、別の理由（離れたマス）も同じに添える。 */
export const rejectionNames = {
  "outside-board": "盤面の外",
  "not-adjacent": "離れたマス",
  hole: "穴",
  visited: "通ったマス",
} as const satisfies Record<HitofudePuzzleExtensionRejection, string>;

/** すべてのマスのルールの判定の言葉。行き止まりは、本番の行き止まりの印の意味をここで言う。 */
export const shapeLabels: HowToPlayVerdictLabels = {
  allowed: "完成",
  disallowed: "行き止まり",
};

/** 手のルールの例で、道のマスを押して道がそのマスまで戻ったときに言う、起きたこと。狭い画面でも1行に収まる短さにする。 */
export const rewoundText = "押したマスまで道が戻った";

/** 行き止まりと途中の判定の下に添える、まだ通っていないマスの数。 */
export function describeRemainingCells(count: number): string {
  return `${count}マス残る`;
}
