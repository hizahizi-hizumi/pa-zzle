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
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<PlayRecord>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.gameId === "string" &&
    record.gameId.length > 0 &&
    typeof record.startedAt === "number" &&
    Number.isFinite(record.startedAt) &&
    typeof record.completedAt === "number" &&
    Number.isFinite(record.completedAt) &&
    record.completedAt >= record.startedAt &&
    typeof record.payloadVersion === "number" &&
    Number.isInteger(record.payloadVersion) &&
    record.payloadVersion > 0 &&
    Object.hasOwn(record, "payload")
  );
}
