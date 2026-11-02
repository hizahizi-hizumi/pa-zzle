import {
  formatProblemFeatures,
  type ProblemFeature,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import {
  type TsumeShogiProblemFeatureAxisId,
  type TsumeShogiProblemFeatures,
  tsumeShogiProblemFeatureAxes,
} from "@/games/tsume-shogi/problem/problem-pool";

/** 絞り込みでは、レベルにある値の種類が多いとき、盤上の駒の数は3枚ごとにまとめる。 */
export const tsumeShogiProblemFeatureAxisDisplays = {
  plies: { label: "手数", valueFormat: { kind: "count", unit: "手" } },
  "attacker-hand-piece-count": {
    label: "持駒",
    valueFormat: { kind: "count", unit: "枚" },
  },
  "board-piece-count": {
    label: "盤上の駒",
    valueFormat: { kind: "count", unit: "枚", rangeWidth: 3 },
  },
} as const satisfies Record<
  TsumeShogiProblemFeatureAxisId,
  ProblemFeatureAxisDisplay
>;

export function formatTsumeShogiProblemFeatures(
  features: TsumeShogiProblemFeatures,
): ProblemFeature[] {
  return formatProblemFeatures(
    features,
    tsumeShogiProblemFeatureAxes,
    tsumeShogiProblemFeatureAxisDisplays,
  );
}
