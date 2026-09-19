import type { PlayRecord } from "./play-record";
import {
  getPlayRecordSaveOutcome,
  type PlayRecordAdapter,
  type PlayRecordSaveOutcome,
} from "./presentation";
import {
  appendPlayRecord,
  type PlayRecordStorage,
  readPlayRecords,
} from "./storage";

export function savePlayRecord(
  record: PlayRecord,
  adapter: PlayRecordAdapter,
  storage?: PlayRecordStorage,
): PlayRecordSaveOutcome {
  const previousRecords = readPlayRecords(storage);
  if (previousRecords.some((existing) => existing.id === record.id)) {
    return { status: "recorded" };
  }

  const outcome = getPlayRecordSaveOutcome(previousRecords, record, adapter);
  const saveStatus = appendPlayRecord(record, storage);

  return saveStatus === "failed" ? { status: "failed" } : outcome;
}
