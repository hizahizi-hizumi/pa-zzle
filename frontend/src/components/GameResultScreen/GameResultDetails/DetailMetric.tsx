import type { GameResultDetailMetric } from "@/components/game-result-contract";

type DetailMetricProps = GameResultDetailMetric;

export function DetailMetric({ label, value }: DetailMetricProps) {
  return (
    <div>
      <dt className="text-meta">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
