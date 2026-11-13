import type { PlayOperation } from "@/games/play-vocabulary";
import type { ScoreItem } from "@/games/score";

export type GameResultDetailMetric = {
  label: string;
  value: string;
  scoreItem?: { item: ScoreItem; points: number; maximum: number };
  operationCount?: { operation: PlayOperation; count: number };
};

type DetailMetricProps = GameResultDetailMetric;

export function DetailMetric({ label, value }: DetailMetricProps) {
  return (
    <div>
      <dt className="text-meta">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
