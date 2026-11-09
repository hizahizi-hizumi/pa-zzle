import {
  type GameResultMetric,
  ResultMetric,
} from "@/components/GameResultScreen/ResultMetric";
import type { ResultRecordImprovement } from "@/games/play";

type GameResultMetricsProps = {
  metrics: readonly GameResultMetric[];
  improvements: readonly ResultRecordImprovement[];
};

export function GameResultMetrics({
  metrics,
  improvements,
}: GameResultMetricsProps) {
  return (
    <dl className={`result-metrics result-cols-${metrics.length}`}>
      {metrics.map((metric) => (
        <ResultMetric
          key={metric.recordMetricId ?? metric.label}
          {...metric}
          improvement={improvements.find(
            (item) => item.id === metric.recordMetricId,
          )}
        />
      ))}
    </dl>
  );
}
