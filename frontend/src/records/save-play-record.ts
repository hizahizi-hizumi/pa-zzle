import {
  isBetterPersonalBestValue,
  type PersonalBestUpdate,
} from "./personal-best";
import type { PlayRecord } from "./play-record";
import type { PlayRecordDefinition } from "./play-record-definition";
import {
  appendPlayRecord,
  type PlayRecordStorage,
  readPlayRecords,
} from "./storage";

export type PlayRecordSaveOutcome =
  | { status: "first-record" }
  | { status: "updated"; updates: readonly PersonalBestUpdate[] }
  | { status: "recorded" }
  | { status: "failed" };

function selectComparableRecords(
  records: readonly PlayRecord[],
  currentRecord: PlayRecord,
  definition: PlayRecordDefinition,
): PlayRecord[] {
  const comparisonGroup = definition.getComparisonGroup(currentRecord);
  if (comparisonGroup === null) {
    return [];
  }

  return records.filter((record) => {
    if (!definition.isRecord(record)) {
      return false;
    }

    return definition.getComparisonGroup(record)?.key === comparisonGroup.key;
  });
}

export function getPlayRecordSaveOutcome(
  previousRecords: readonly PlayRecord[],
  currentRecord: PlayRecord,
  definition: PlayRecordDefinition,
): Exclude<PlayRecordSaveOutcome, { status: "failed" }> {
  const previousComparable = selectComparableRecords(
    previousRecords,
    currentRecord,
    definition,
  );
  if (previousComparable.length === 0) {
    return { status: "first-record" };
  }

  const updates = definition.personalBestMetrics.flatMap((metric) => {
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
      isBetterPersonalBestValue(value, best, metric.direction) ? value : best,
    );
    if (
      !isBetterPersonalBestValue(currentValue, previousBest, metric.direction)
    ) {
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

export function savePlayRecord(
  record: PlayRecord,
  definition: PlayRecordDefinition,
  storage?: PlayRecordStorage,
): PlayRecordSaveOutcome {
  const previousRecords = readPlayRecords(storage);
  if (previousRecords.some((existing) => existing.id === record.id)) {
    return { status: "recorded" };
  }

  const outcome = getPlayRecordSaveOutcome(previousRecords, record, definition);
  const saveStatus = appendPlayRecord(record, storage);

  return saveStatus === "failed" ? { status: "failed" } : outcome;
}
