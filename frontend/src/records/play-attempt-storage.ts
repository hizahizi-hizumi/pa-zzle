import {
  isPlayAttempt,
  isPlayRecordOfAttempt,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import {
  getDefaultStorage,
  type PlayRecordStorage,
  readPlayRecords,
} from "@/records/storage";

const PLAY_ATTEMPTS_STORAGE_KEY = "pa-zzle.play-attempts.v1";

export function readPlayAttempts(
  storage: PlayRecordStorage | null = getDefaultStorage(),
): PlayAttempt[] {
  if (!storage) {
    return [];
  }

  try {
    const stored = storage.getItem(PLAY_ATTEMPTS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPlayAttempt);
  } catch {
    return [];
  }
}

function writePlayAttempts(
  attempts: readonly PlayAttempt[],
  storage: PlayRecordStorage,
): boolean {
  try {
    storage.setItem(PLAY_ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts));
    return true;
  } catch {
    return false;
  }
}

/** プレイを始めた事実を保存する。同じ試行は重ねて保存しない。 */
export function startPlayAttempt(
  attempt: PlayAttempt,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): "saved" | "duplicate" | "failed" {
  if (!storage) {
    return "failed";
  }

  const attempts = readPlayAttempts(storage);
  if (attempts.some((existing) => existing.id === attempt.id)) {
    return "duplicate";
  }

  return writePlayAttempts([...attempts, attempt], storage)
    ? "saved"
    : "failed";
}

/**
 * プレイを離れた事実を保存する。
 * 離脱を記録済みの試行と、完了記録がある試行には保存しない。
 */
export function abandonPlayAttempt(
  attemptId: string,
  abandonment: PlayAttemptAbandonment,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): "saved" | "ignored" | "failed" {
  if (!storage) {
    return "failed";
  }

  const attempts = readPlayAttempts(storage);
  const attempt = attempts.find((existing) => existing.id === attemptId);
  if (
    !attempt ||
    attempt.abandonment ||
    abandonment.abandonedAt < attempt.startedAt ||
    readPlayRecords(storage).some((record) =>
      isPlayRecordOfAttempt(record, attempt),
    )
  ) {
    return "ignored";
  }

  return writePlayAttempts(
    attempts.map((existing) =>
      existing === attempt ? { ...existing, abandonment } : existing,
    ),
    storage,
  )
    ? "saved"
    : "failed";
}

/**
 * 離脱として保存した試行を、続いているプレイへ戻す。
 * ページを離れたあとに同じページへ戻ってプレイが続く場合に使う。
 */
export function resumePlayAttempt(
  attemptId: string,
  abandonedAt: number,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): "saved" | "ignored" | "failed" {
  if (!storage) {
    return "failed";
  }

  const attempts = readPlayAttempts(storage);
  const attempt = attempts.find((existing) => existing.id === attemptId);
  if (attempt?.abandonment?.abandonedAt !== abandonedAt) {
    return "ignored";
  }

  return writePlayAttempts(
    attempts.map((existing) =>
      existing === attempt ? { ...existing, abandonment: null } : existing,
    ),
    storage,
  )
    ? "saved"
    : "failed";
}
