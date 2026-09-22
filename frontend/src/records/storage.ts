import { isPlayRecord, type PlayRecord } from "@/records/play-record";

const PLAY_RECORDS_STORAGE_KEY = "pa-zzle.play-records.v1";

export type PlayRecordStorage = Pick<Storage, "getItem" | "setItem">;

function getDefaultStorage(): PlayRecordStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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
