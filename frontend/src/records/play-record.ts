import {
  isFiniteNumber,
  isNonEmptyString,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

export type PlayRecord = {
  id: string;
  gameId: string;
  startedAt: number;
  completedAt: number;
  payloadVersion: number;
  payload: unknown;
};

export function createPlayRecordId(
  parts: readonly (string | number)[],
): string {
  return parts.map(String).join(":");
}

export function isPlayRecord(value: unknown): value is PlayRecord {
  return (
    isRecordObject(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.gameId) &&
    isFiniteNumber(value.startedAt) &&
    isFiniteNumber(value.completedAt) &&
    value.completedAt >= value.startedAt &&
    isPositiveInteger(value.payloadVersion) &&
    Object.hasOwn(value, "payload")
  );
}
