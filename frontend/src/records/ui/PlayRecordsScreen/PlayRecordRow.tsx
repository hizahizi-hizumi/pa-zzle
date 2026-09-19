import {
  getPersonalBestMetricIdsForRecord,
  type PersonalBest,
} from "@/records/personal-best";
import type { PlayRecord } from "@/records/play-record";
import { formatRecordCompletedAt } from "@/records/ui/format";
import {
  getPersonalBestMetricDisplay,
  type PlayRecordDisplayDefinition,
} from "@/records/ui/play-record-display";

type PlayRecordRowProps = {
  record: PlayRecord;
  display: PlayRecordDisplayDefinition;
  personalBests: readonly PersonalBest[];
};

export function PlayRecordRow({
  record,
  display,
  personalBests,
}: PlayRecordRowProps) {
  const summary = display.getSummary(record);
  if (!summary) {
    return null;
  }

  const bestMetricIds = getPersonalBestMetricIdsForRecord(
    record,
    personalBests,
    display.definition,
  );
  const bestLabels = bestMetricIds.flatMap((metricId) => {
    const metricDisplay = getPersonalBestMetricDisplay(display, metricId);
    return metricDisplay ? [metricDisplay.label] : [];
  });

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 sm:flex-nowrap">
        <p className="w-full shrink-0 text-xs text-muted-foreground sm:w-24">
          {formatRecordCompletedAt(record.completedAt)}
        </p>
        <div className="flex min-w-24 items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">
            {summary.primaryMetric.label}
          </span>
          <span className="font-mono text-base font-semibold tabular-nums">
            {summary.primaryMetric.value}
          </span>
        </div>
        <dl className="flex flex-1 flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
          {summary.detailMetrics.map((metric) => (
            <div key={metric.label} className="flex items-baseline gap-1">
              <dt className="text-muted-foreground">{metric.label}</dt>
              <dd className="font-mono font-medium tabular-nums">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
        {bestLabels.length > 0 && (
          <span
            className="shrink-0 text-xs font-medium"
            aria-label={`自己ベスト: ${bestLabels.join("、")}`}
            title={bestLabels.join("、")}
          >
            ベスト
          </span>
        )}
      </div>
    </li>
  );
}
