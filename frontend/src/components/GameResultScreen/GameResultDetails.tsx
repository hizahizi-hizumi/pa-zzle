import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import {
  DetailMetric,
  type GameResultDetailMetric,
} from "@/components/GameResultScreen/GameResultDetails/DetailMetric";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type GameResultScoreCriterion = {
  label: string;
  description: string;
};

export type GameResultScoreCriteria = readonly GameResultScoreCriterion[];

/** 全ゲームの全項目に共通する点の丸め方。 */
const SCORE_ROUNDING_NOTE = "各項目は1点単位に四捨五入し、0点を下限とする。";

type GameResultDetailsProps = {
  breakdown: readonly GameResultDetailMetric[];
  criteria: GameResultScoreCriteria;
};

export function GameResultDetails({
  breakdown,
  criteria,
}: GameResultDetailsProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="mt-3 flex justify-center">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            {open ? <ChevronUp /> : <ChevronDown />}
            スコアの内訳・採点基準
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mt-2 rounded-xl border-(length:--border-width-normal) px-3 py-3 text-supporting text-muted-foreground">
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
