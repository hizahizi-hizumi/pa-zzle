import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Equal,
  Move,
  Undo2,
  X,
} from "lucide-react";
import {
  type GameResultMetric,
  ResultMetric,
} from "@/components/GameResultScreen/ResultMetric";

type Issue690MetricsProps = {
  metrics: readonly GameResultMetric[];
  variant?: "standard" | "quiet";
};

const metricIcons = {
  時間: Clock3,
  手数: Move,
  ミス: X,
  待った: Undo2,
} as const;

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

export function Issue690Metrics({
  metrics,
  variant = "standard",
}: Issue690MetricsProps) {
  return (
    <dl className={`i690-metrics i690-cols-${metrics.length}`}>
      {metrics.map((metric) => {
        if (variant === "standard") {
          return (
            <ResultMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
            />
          );
        }
        const Icon = metricIcons[metric.label as keyof typeof metricIcons];
        const comparison = metric.comparison;
        const Direction = comparison
          ? comparison.difference < 0
            ? ArrowDownRight
            : comparison.difference > 0
              ? ArrowUpRight
              : Equal
          : null;
        return (
          <div key={metric.label} className="i690-quiet-metric">
            <dt className="i690-metric-label">
              {Icon && <Icon aria-hidden="true" />}
              <span>{metric.label}</span>
            </dt>
            <dd>{metric.value}</dd>
            {comparison && Direction && (
              <dd
                className="i690-metric-comparison"
                title={describeComparison(comparison)}
                aria-label={describeComparison(comparison)}
              >
                <Direction aria-hidden="true" />
                <span aria-hidden="true">{comparison.display}</span>
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
