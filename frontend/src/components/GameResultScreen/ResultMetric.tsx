import { ArrowDownRight, ArrowUpRight, Award, Equal } from "lucide-react";
import type { ResultRecordImprovement } from "@/games/play";

export type GameResultMetric = {
  label: string;
  recordMetricId?: string;
  value: string;
  comparison?: {
    basis: "referenceTime" | "minimumMoves";
    difference: number;
    display: string;
  };
};

type ResultMetricProps = GameResultMetric & {
  improvement?: ResultRecordImprovement;
};

function describeComparison({
  basis,
  difference,
  display,
}: NonNullable<GameResultMetric["comparison"]>): string {
  const reference = basis === "referenceTime" ? "基準時間" : "最短手数";
  const meaning =
    difference === 0
      ? "と同じ"
      : difference < 0
        ? basis === "referenceTime"
          ? "より短い"
          : "より少ない"
        : basis === "referenceTime"
          ? "より長い"
          : "より多い";
  return `${reference}${meaning} ${display}`;
}

export function ResultMetric({
  label,
  value,
  comparison,
  improvement,
}: ResultMetricProps) {
  const Direction = comparison
    ? comparison.difference < 0
      ? ArrowDownRight
      : comparison.difference > 0
        ? ArrowUpRight
        : Equal
    : null;
  return (
    <div className="result-quiet-metric">
      <dt className="result-metric-label">{label}</dt>
      <dd>{value}</dd>
      {comparison && Direction && (
        <dd
          className="result-metric-comparison"
          title={describeComparison(comparison)}
          aria-label={describeComparison(comparison)}
        >
          <Direction aria-hidden="true" />
          <span aria-hidden="true">
            {comparison.basis === "referenceTime" ? "基準差" : "最短差"}{" "}
            {comparison.display}
          </span>
        </dd>
      )}
      {improvement && (
        <dd
          className="result-metric-best"
          title={`${improvement.label}：${improvement.previous}から${improvement.current}へ`}
          aria-label={`${improvement.label}の自己ベスト更新：${improvement.previous}から${improvement.current}、${improvement.improvement}`}
        >
          <Award aria-hidden="true" />
          <strong aria-hidden="true">
            {comparison &&
              (comparison.basis === "referenceTime" ? "基準差 " : "最短差 ")}
            {improvement.improvement}
          </strong>
        </dd>
      )}
    </div>
  );
}
