import { ResultMetric } from "@/components/GameResultScreen/ResultMetric";
import type { GameResultMetric } from "@/components/game-result-contract";
import type {
  ResultRecordComparison,
  ResultRecordImprovement,
} from "@/games/play";

type GameResultMetricsProps = {
  metrics: readonly GameResultMetric[];
  improvements: readonly ResultRecordImprovement[];
  comparisons?: readonly ResultRecordComparison[];
};

export function GameResultMetrics({
  metrics,
  improvements,
  comparisons = [],
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
          bestComparison={comparisons.find(
            (item) => item.id === metric.recordMetricId,
          )}
        />
      ))}
    </dl>
  );
}
