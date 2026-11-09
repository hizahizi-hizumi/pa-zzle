import type {
  ResultRecordFeedback,
  ResultRecordImprovement,
} from "@/games/play";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";
import { getPlayRecordMetricDisplay } from "@/records/ui/play-record-display";

export function createResultRecordFeedback(
  outcome: PlayRecordSaveOutcome | null | undefined,
  display: PlayRecordDisplayDefinition | undefined,
): ResultRecordFeedback {
  if (outcome?.status === "first-record" || outcome?.status === "failed")
    return { kind: outcome.status };
  if (outcome?.status !== "updated" || !display) return { kind: "none" };

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
    ? { kind: "updated", improvements }
    : { kind: "none" };
}
