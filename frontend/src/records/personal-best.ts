import type { PlayRecord } from "./play-record";
import type {
  PersonalBestMetricDefinition,
  PlayRecordDefinition,
} from "./play-record-definition";

export type PersonalBest = {
  metricId: string;
  label: string;
  value: string;
  rawValue: number;
};

export type PersonalBestUpdate = {
  metricId: string;
  label: string;
  previousValue: string;
  currentValue: string;
};

export function isBetterPersonalBestValue(
  value: number,
  best: number,
  direction: PersonalBestMetricDefinition["direction"],
): boolean {
  return direction === "higher" ? value > best : value < best;
}

export function getPersonalBests(
  records: readonly PlayRecord[],
  definition: PlayRecordDefinition,
): PersonalBest[] {
  return definition.personalBestMetrics.flatMap((metric) => {
    let bestValue: number | null = null;
    for (const record of records) {
      const value = metric.getValue(record);
      if (value === null) {
        continue;
      }
      if (
        bestValue === null ||
        isBetterPersonalBestValue(value, bestValue, metric.direction)
      ) {
        bestValue = value;
      }
    }

    return bestValue === null
      ? []
      : [
          {
            metricId: metric.id,
            label: metric.label,
            value: metric.formatValue(bestValue),
            rawValue: bestValue,
          },
        ];
  });
}

export function getPersonalBestMetricLabelsForRecord(
  record: PlayRecord,
  personalBests: readonly PersonalBest[],
  definition: PlayRecordDefinition,
): string[] {
  return definition.personalBestMetrics.flatMap((metric) => {
    const value = metric.getValue(record);
    const best = personalBests.find((item) => item.metricId === metric.id);
    return value !== null && best && value === best.rawValue
      ? [metric.label]
      : [];
  });
}
