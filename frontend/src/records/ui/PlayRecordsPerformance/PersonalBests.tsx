import { useId } from "react";

import type { PersonalBest } from "@/records/personal-best";
import {
  getPlayRecordMetricDisplay,
  type PlayRecordDisplayDefinition,
} from "@/records/ui/play-record-display";

type PersonalBestsProps = {
  personalBests: readonly PersonalBest[];
  display: PlayRecordDisplayDefinition;
};

export function PersonalBests({ personalBests, display }: PersonalBestsProps) {
  const headingId = useId();

  return (
    <section
      className="flex flex-wrap items-baseline gap-x-6 gap-y-2"
      aria-labelledby={headingId}
    >
      <h3
        id={headingId}
        className="text-meta font-medium text-muted-foreground"
      >
        自己ベスト
      </h3>
      {personalBests.length === 0 && (
        <p className="text-meta text-muted-foreground">
          まだクリアしていません
        </p>
      )}
      <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {personalBests.flatMap((best) => {
          const metricDisplay = getPlayRecordMetricDisplay(
            display,
            best.metricId,
          );
          return metricDisplay
            ? [
                <div key={best.metricId} className="flex items-baseline gap-2">
                  <dt className="text-meta text-muted-foreground">
                    {metricDisplay.label}
                  </dt>
                  <dd className="font-ui text-body font-semibold tabular-nums">
                    {metricDisplay.formatValue(best.value)}
                  </dd>
                </div>,
              ]
            : [];
        })}
      </dl>
    </section>
  );
}
