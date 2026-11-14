import {
  formatProblemFeatureValue,
  type ProblemFeatureAxisDisplay,
} from "@/components/problem-features";
import type {
  ZukanFeatureOption,
  ZukanPerformanceAxis,
  ZukanPerformanceCondition,
} from "@/features/zukan/zukan-filter";

export type ZukanFilterFeatureAxis = {
  axisId: string;
  display: ProblemFeatureAxisDisplay;
  options: readonly ZukanFeatureOption[];
};

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
