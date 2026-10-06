import { isRecordObject } from "@/lib/type-guards";
import {
  isBetterPersonalBestValue,
  type PersonalBestUpdate,
} from "@/records/personal-best";
import { removeClearedPlayAttempts } from "@/records/play-attempt-storage";
import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";
import {
  appendPlayRecord,
  type PlayRecordStorage,
  readPlayRecords,
} from "@/records/storage";

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
  const comparisonKey = definition.getComparisonKey(currentRecord);
  if (comparisonKey === null) {
    return [];
  }

  return records.filter((record) => {
    if (!definition.isRecord(record)) {
      return false;
    }

    return definition.getComparisonKey(record) === comparisonKey;
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
        previousValue: previousBest,
        currentValue,
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
  if (saveStatus === "failed") {
    return { status: "failed" };
  }

  removeClearedPlayAttempts(storage);
  return outcome;
}

function isPersonalBestUpdate(value: unknown): value is PersonalBestUpdate {
  return (
    isRecordObject(value) &&
    typeof value.metricId === "string" &&
    typeof value.previousValue === "number" &&
    typeof value.currentValue === "number"
  );
}

/** 履歴の state など外部から読み戻した値が、保存結果の形をしているかを確かめる。 */
export function isPlayRecordSaveOutcome(
  value: unknown,
): value is PlayRecordSaveOutcome {
  if (!isRecordObject(value)) {
    return false;
  }

  switch (value.status) {
    case "first-record":
    case "recorded":
    case "failed":
      return true;
    case "updated":
      return (
        Array.isArray(value.updates) &&
        value.updates.every(isPersonalBestUpdate)
      );
    default:
      return false;
  }
}
