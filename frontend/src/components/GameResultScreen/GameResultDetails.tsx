import {
  DetailMetric,
  type GameResultDetailMetric,
} from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type GameResultScoreCriterion = {
  label: string;
  description: string;
};

export type GameResultScoreCriteria = readonly GameResultScoreCriterion[];

const SCORE_ROUNDING_NOTE = "各項目は1点単位に四捨五入し、0点を下限とする。";

type GameResultDetailsProps = {
  breakdown: readonly GameResultDetailMetric[];
  criteria: GameResultScoreCriteria;
};

export function GameResultDetails({
  breakdown,
  criteria,
}: GameResultDetailsProps) {
  const details = (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {breakdown.map((metric) => (
          <DetailMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </dl>
      <div className="mt-3 border-t-(length:--border-width-normal) pt-3">
        <dl className="mt-3 grid gap-3 text-meta">
          {criteria.map((criterion) => (
            <div key={criterion.label}>
              <dt className="font-semibold text-foreground">
                {criterion.label}
              </dt>
              <dd className="mt-1">{criterion.description}</dd>
            </div>
          ))}
          <div>
            <dt className="sr-only">丸め</dt>
            <dd>{SCORE_ROUNDING_NOTE}</dd>
          </div>
        </dl>
      </div>
    </>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="quiet" size="context">
          採点内訳
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(78svh,680px)] overflow-y-auto">
        <DialogTitle>スコアの内訳・採点基準</DialogTitle>
        <div className="text-supporting text-muted-foreground">{details}</div>
      </DialogContent>
    </Dialog>
  );
}
