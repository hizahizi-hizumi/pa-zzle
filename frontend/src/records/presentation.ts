import type { PlayRecord } from "./play-record";

export type PlayRecordMetricPresentation = {
  label: string;
  value: string;
};

export type PlayRecordHistoryPresentation = {
  primaryMetric: PlayRecordMetricPresentation;
  detailMetrics: readonly PlayRecordMetricPresentation[];
};

export type PersonalBestMetricDefinition = {
  id: string;
  label: string;
  direction: "higher" | "lower";
  getValue: (record: PlayRecord) => number | null;
  formatValue: (value: number) => string;
};

export type PlayRecordAdapter = {
  gameId: string;
  gameLabel: string;
  isRecord: (record: PlayRecord) => boolean;
  getComparisonKey: (record: PlayRecord) => string | null;
  getComparisonLabel: (record: PlayRecord) => string | null;
  getHistoryPresentation: (
    record: PlayRecord,
  ) => PlayRecordHistoryPresentation | null;
  personalBestMetrics: readonly PersonalBestMetricDefinition[];
};

export type PersonalBestPresentation = {
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

export type PlayRecordSaveOutcome =
  | { status: "first-record" }
  | { status: "updated"; updates: readonly PersonalBestUpdate[] }
  | { status: "recorded" }
  | { status: "failed" };

function isBetter(
  value: number,
  best: number,
  direction: PersonalBestMetricDefinition["direction"],
): boolean {
  return direction === "higher" ? value > best : value < best;
}

function selectComparableRecords(
  records: readonly PlayRecord[],
  currentRecord: PlayRecord,
  adapter: PlayRecordAdapter,
): PlayRecord[] {
  const comparisonKey = adapter.getComparisonKey(currentRecord);
  if (comparisonKey === null) {
    return [];
  }

  return records.filter(
    (record) =>
      adapter.isRecord(record) &&
      adapter.getComparisonKey(record) === comparisonKey,
  );
}

export function getPersonalBests(
  records: readonly PlayRecord[],
  adapter: PlayRecordAdapter,
): PersonalBestPresentation[] {
  return adapter.personalBestMetrics.flatMap((metric) => {
    let bestValue: number | null = null;
    for (const record of records) {
      const value = metric.getValue(record);
      if (value === null) {
        continue;
      }
      if (bestValue === null || isBetter(value, bestValue, metric.direction)) {
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
  personalBests: readonly PersonalBestPresentation[],
  adapter: PlayRecordAdapter,
): string[] {
  return adapter.personalBestMetrics.flatMap((metric) => {
    const value = metric.getValue(record);
    const best = personalBests.find((item) => item.metricId === metric.id);
    return value !== null && best && value === best.rawValue
      ? [metric.label]
      : [];
  });
}

export function getPlayRecordSaveOutcome(
  previousRecords: readonly PlayRecord[],
  currentRecord: PlayRecord,
  adapter: PlayRecordAdapter,
): Exclude<PlayRecordSaveOutcome, { status: "failed" }> {
  const previousComparable = selectComparableRecords(
    previousRecords,
    currentRecord,
    adapter,
  );
  if (previousComparable.length === 0) {
    return { status: "first-record" };
  }

  const updates = adapter.personalBestMetrics.flatMap((metric) => {
    const currentValue = metric.getValue(currentRecord);
    if (currentValue === null) {
      return [];
    }

    const previousValues = previousComparable
      .map(metric.getValue)
      .filter((value): value is number => value !== null);
    if (previousValues.length === 0) {
      return [];
    }

    const previousBest = previousValues.reduce((best, value) =>
      isBetter(value, best, metric.direction) ? value : best,
    );
    if (!isBetter(currentValue, previousBest, metric.direction)) {
      return [];
    }

    return [
      {
        metricId: metric.id,
        label: metric.label,
        previousValue: metric.formatValue(previousBest),
        currentValue: metric.formatValue(currentValue),
      },
    ];
  });

  return updates.length > 0
    ? { status: "updated", updates }
    : { status: "recorded" };
}
