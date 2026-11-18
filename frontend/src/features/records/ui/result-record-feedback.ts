import {
  getPersonalBests,
  listComparableRecords,
} from "@/features/records/personal-best";
import type { PlayRecord } from "@/features/records/play-record";
import type { PlayRecordSaveOutcome } from "@/features/records/save-play-record";
import type { PlayRecordDisplayDefinition } from "@/features/records/ui/play-record-display";
import { getPlayRecordMetricDisplay } from "@/features/records/ui/play-record-display";
import type {
  ResultRecordComparison,
  ResultRecordFeedback,
  ResultRecordImprovement,
} from "@/games/play";

function createResultRecordComparisons(
  currentRecord: PlayRecord,
  previousRecords: readonly PlayRecord[],
  display: PlayRecordDisplayDefinition,
): ResultRecordComparison[] {
  const { definition } = display;
  if (!definition.isRecord(currentRecord)) return [];
  const comparisonKey = definition.getComparisonKey(currentRecord);
  if (comparisonKey === null) return [];

  const previousBests = getPersonalBests(
    listComparableRecords(previousRecords, definition, comparisonKey),
    definition,
  );

  return previousBests.flatMap(({ metricId, value }) => {
    const metric = definition.personalBestMetrics.find(
      (candidate) => candidate.id === metricId,
    );
    const presentation = getPlayRecordMetricDisplay(display, metricId);
    const currentValue = metric?.getValue(currentRecord) ?? null;
    if (!metric || !presentation || currentValue === null) return [];

    const difference = currentValue - value;
    const sign = difference === 0 ? "±" : difference > 0 ? "+" : "−";
    return [
      {
        id: metricId,
        label: presentation.label,
        previous: presentation.formatValue(value),
        current: presentation.formatValue(currentValue),
        delta: `${sign}${presentation.formatGap(Math.abs(difference))}`,
      },
    ];
  });
}

export function createResultRecordFeedback(
  outcome: PlayRecordSaveOutcome | null | undefined,
  display: PlayRecordDisplayDefinition | undefined,
  comparison?: {
    currentRecord: PlayRecord;
    previousRecords: readonly PlayRecord[];
  },
): ResultRecordFeedback {
  if (outcome?.status === "first-record" || outcome?.status === "failed")
    return { kind: outcome.status };
  if (!display) return { kind: "none" };

  const comparisons = comparison
    ? createResultRecordComparisons(
        comparison.currentRecord,
        comparison.previousRecords,
        display,
      )
    : [];
  const comparisonFeedback = comparisons.length ? { comparisons } : {};
  if (outcome?.status !== "updated")
    return { kind: "none", ...comparisonFeedback };

  const improvements: ResultRecordImprovement[] = outcome.updates.flatMap(
    (update) => {
      const metric = getPlayRecordMetricDisplay(display, update.metricId);
      if (!metric) return [];
      const direction = display.definition.personalBestMetrics.find(
        (item) => item.id === update.metricId,
      )?.direction;
      const amount = Math.max(
        0,
        direction === "higher"
          ? update.currentValue - update.previousValue
          : update.previousValue - update.currentValue,
      );
      return [
        {
          id: update.metricId,
          label: metric.label,
          previous: metric.formatValue(update.previousValue),
          current: metric.formatValue(update.currentValue),
          improvement: metric.formatImprovement(amount),
        },
      ];
    },
  );
  return improvements.length
    ? { kind: "updated", improvements, ...comparisonFeedback }
    : { kind: "none", ...comparisonFeedback };
}
