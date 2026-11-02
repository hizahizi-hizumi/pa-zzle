import type { PlayRecord } from "@/records/play-record";
import type {
  PersonalBestMetricDefinition,
  PlayRecordDefinition,
} from "@/records/play-record-definition";

export type PersonalBest = {
  metricId: string;
  value: number;
};

export type PersonalBestUpdate = {
  metricId: string;
  previousValue: number;
  currentValue: number;
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
            value: bestValue,
          },
        ];
  });
}

/** 比較単位（同じゲームの同じ開始条件）の記録を、完了した時刻の新しい順に選ぶ。 */
export function listComparableRecords(
  records: readonly PlayRecord[],
  definition: PlayRecordDefinition,
  comparisonKey: string,
): PlayRecord[] {
  return records
    .filter(
      (record) =>
        definition.isRecord(record) &&
        definition.getComparisonKey(record) === comparisonKey,
    )
    .sort((left, right) => right.completedAt - left.completedAt);
}
