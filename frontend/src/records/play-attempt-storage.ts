import {
  getPlayAttemptStatus,
  isPlayAttempt,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import {
  getDefaultStorage,
  type PlayRecordStorage,
  readPlayRecords,
} from "@/records/storage";

const PLAY_ATTEMPTS_STORAGE_KEY = "pa-zzle.play-attempts.v1";

type PlayAttemptsSnapshot = {
  stored: string | null;
  attempts: readonly PlayAttempt[];
};

const listeners = new Set<() => void>();
let snapshot: PlayAttemptsSnapshot | null = null;

function readStoredPlayAttempts(storage: PlayRecordStorage): string | null {
  try {
    return storage.getItem(PLAY_ATTEMPTS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function parsePlayAttempts(stored: string | null): PlayAttempt[] {
  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isPlayAttempt) : [];
  } catch {
    return [];
  }
}

export function readPlayAttempts(
  storage: PlayRecordStorage | null = getDefaultStorage(),
): PlayAttempt[] {
  return storage ? parsePlayAttempts(readStoredPlayAttempts(storage)) : [];
}

/**
 * 既定の保存先の試行を、保存内容が変わるまで同じ配列で返す。
 * `subscribePlayAttempts` と組み合わせて、画面を保存内容へ追従させる。
 */
export function readPlayAttemptsSnapshot(): readonly PlayAttempt[] {
  const storage = getDefaultStorage();
  const stored = storage ? readStoredPlayAttempts(storage) : null;
  if (snapshot?.stored !== stored) {
    snapshot = { stored, attempts: parsePlayAttempts(stored) };
  }
  return snapshot.attempts;
}

/** 試行を保存し直すたびに `listener` を呼ぶ。戻り値で購読をやめる。 */
export function subscribePlayAttempts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function writePlayAttempts(
  attempts: readonly PlayAttempt[],
  storage: PlayRecordStorage,
): boolean {
  try {
    storage.setItem(PLAY_ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    return false;
  }

  for (const listener of listeners) {
    listener();
  }
  return true;
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
    getPlayAttemptStatus(attempt, readPlayRecords(storage)) === "cleared"
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
 * 始めたプレイを、遊んでいないものとして保存から除く。
 * 離脱にも未完了にも数えないプレイに使う。
 */
export function discardPlayAttempt(
  attemptId: string,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): "saved" | "ignored" | "failed" {
  if (!storage) {
    return "failed";
  }

  const attempts = readPlayAttempts(storage);
  const remaining = attempts.filter((attempt) => attempt.id !== attemptId);
  if (remaining.length === attempts.length) {
    return "ignored";
  }

  return writePlayAttempts(remaining, storage) ? "saved" : "failed";
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

/**
 * 完了記録がある試行を保存から除く。クリアした試行は完了記録から導出できるので保持しない。
 * 完了記録を保存したあとに呼ぶ。
 */
export function removeClearedPlayAttempts(
  storage: PlayRecordStorage | null = getDefaultStorage(),
): "saved" | "ignored" | "failed" {
  if (!storage) {
    return "failed";
  }

  const attempts = readPlayAttempts(storage);
  const records = readPlayRecords(storage);
  const remaining = attempts.filter(
    (attempt) => getPlayAttemptStatus(attempt, records) !== "cleared",
  );
  if (remaining.length === attempts.length) {
    return "ignored";
  }

  return writePlayAttempts(remaining, storage) ? "saved" : "failed";
}
