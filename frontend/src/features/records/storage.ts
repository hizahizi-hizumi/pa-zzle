import { isPlayRecord, type PlayRecord } from "@/features/records/play-record";
import { type BrowserStorage, getDefaultStorage } from "@/lib/browser-storage";

type PlayRecordStorage = BrowserStorage;

const PLAY_RECORDS_STORAGE_KEY = "pa-zzle.play-records.v1";

export function readPlayRecords(
  storage: PlayRecordStorage | null = getDefaultStorage(),
): PlayRecord[] {
  if (!storage) {
    return [];
  }

  try {
    const stored = storage.getItem(PLAY_RECORDS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPlayRecord);
  } catch {
    return [];
  }
}

export function writePlayRecords(
  records: readonly PlayRecord[],
  storage: PlayRecordStorage | null = getDefaultStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(PLAY_RECORDS_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

export function appendPlayRecord(
  record: PlayRecord,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): "saved" | "duplicate" | "failed" {
  const records = readPlayRecords(storage);
  if (records.some((existing) => existing.id === record.id)) {
    return "duplicate";
  }

  return writePlayRecords([...records, record], storage) ? "saved" : "failed";
}

export function findPlayRecord(
  recordId: string,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): PlayRecord | null {
  return (
    readPlayRecords(storage).find((record) => record.id === recordId) ?? null
  );
}
