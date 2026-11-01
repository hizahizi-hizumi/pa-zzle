import {
  formatProblemFeatureValue,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import type {
  ZukanFeatureOption,
  ZukanPerformanceAxis,
  ZukanPerformanceCondition,
} from "@/zukan/zukan-filter";

/** 絞り込みに示す特徴の1つの軸。開いているレベルの問題集にある値から作った選択肢を持つ。 */
export type ZukanFilterFeatureAxis = {
  axisId: string;
  display: ProblemFeatureAxisDisplay;
  options: readonly ZukanFeatureOption[];
};

/** 特徴の選択肢の書き方。0個は「なし」、まとめた数は範囲で示す。 */
export function formatZukanFeatureOption(
  option: ZukanFeatureOption,
  display: ProblemFeatureAxisDisplay,
): string {
  if (option.kind === "board-size") {
    return formatProblemFeatureValue(option, display);
  }
  const { min, max } = option;
  if (min === max) {
    return min === 0
      ? "なし"
      : formatProblemFeatureValue({ kind: "count", count: min }, display);
  }
  return `${min}〜${formatProblemFeatureValue({ kind: "count", count: max }, display)}`;
}

export const zukanPerformanceAxisLabels: Record<ZukanPerformanceAxis, string> =
  {
    mistakes: "ミス",
    moves: "手数",
  };

export const zukanPerformanceConditionLabels: Record<
  ZukanPerformanceCondition,
  string
> = {
  "no-mistakes": "ミスなし",
  "with-mistakes": "ミスあり",
  "optimal-moves": "最短手数",
  "over-optimal-moves": "最短より多い",
};
