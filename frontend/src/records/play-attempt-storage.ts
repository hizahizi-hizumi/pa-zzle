import {
  isPlayAttempt,
  isPlayAttemptCleared,
  isSamePlayStart,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import {
  getDefaultStorage,
  type PlayRecordStorage,
  readPlayRecords,
} from "@/records/storage";

const PLAY_ATTEMPTS_STORAGE_KEY = "pa-zzle.play-attempts.v1";

const listeners = new Set<() => void>();
let snapshot: { stored: string | null; attempts: PlayAttempt[] } | null = null;

function readStoredPlayAttempts(
  storage: PlayRecordStorage | null,
): string | null {
  try {
    return storage?.getItem(PLAY_ATTEMPTS_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function parsePlayAttempts(stored: string | null): PlayAttempt[] {
  try {
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isPlayAttempt) : [];
  } catch {
    return [];
  }
}

export function readPlayAttempts(
  storage: PlayRecordStorage | null = getDefaultStorage(),
): PlayAttempt[] {
  return parsePlayAttempts(readStoredPlayAttempts(storage));
}

/** `subscribePlayAttempts` と組み合わせて、画面を保存内容へ追従させる。 */
export function readPlayAttemptsSnapshot(): readonly PlayAttempt[] {
  const stored = readStoredPlayAttempts(getDefaultStorage());
  if (snapshot?.stored !== stored) {
    snapshot = { stored, attempts: parsePlayAttempts(stored) };
  }
  return snapshot.attempts;
}

export function subscribePlayAttempts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function updatePlayAttempts(
  storage: PlayRecordStorage | null,
  update: (
    attempts: PlayAttempt[],
    storage: PlayRecordStorage,
  ) => PlayAttempt[] | null,
): void {
  if (!storage) {
    return;
  }

  const updated = update(readPlayAttempts(storage), storage);
  if (!updated) {
    return;
  }

  try {
    storage.setItem(PLAY_ATTEMPTS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // 保存できなくてもプレイを妨げないよう、失敗は無視する。
    return;
  }
  for (const listener of listeners) {
    listener();
  }
}

export function startPlayAttempt(
  attempt: PlayAttempt,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): void {
  updatePlayAttempts(storage, (attempts) =>
    attempts.some((existing) => isSamePlayStart(existing, attempt))
      ? null
      : [...attempts, attempt],
  );
}

export function abandonPlayAttempt(
  play: Pick<PlayAttempt, "gameId" | "startedAt">,
  abandonment: PlayAttemptAbandonment,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): void {
  updatePlayAttempts(storage, (attempts, available) => {
    const attempt = attempts.find((existing) =>
      isSamePlayStart(existing, play),
    );
    if (
      !attempt ||
      attempt.abandonment ||
      abandonment.abandonedAt < attempt.startedAt ||
      isPlayAttemptCleared(attempt, readPlayRecords(available))
    ) {
      return null;
    }

    return attempts.map((existing) =>
      existing === attempt ? { ...existing, abandonment } : existing,
    );
  });
}

/**
 * まだ離脱も完了もしていない試行を、記録から除く。始めただけで操作しないまま離れたプレイを残さないために使う。
 */
export function discardPlayAttempt(
  play: Pick<PlayAttempt, "gameId" | "startedAt">,
  storage: PlayRecordStorage | null = getDefaultStorage(),
): void {
  updatePlayAttempts(storage, (attempts) => {
    const remaining = attempts.filter(
      (existing) =>
        !isSamePlayStart(existing, play) || existing.abandonment !== null,
    );
    return remaining.length === attempts.length ? null : remaining;
  });
}

/**
 * クリアした試行は完了記録から導出できるので保持しない。
 * 完了記録を保存したあとに呼ぶ。
 */
export function removeClearedPlayAttempts(
  storage: PlayRecordStorage | null = getDefaultStorage(),
): void {
  updatePlayAttempts(storage, (attempts, available) => {
    const records = readPlayRecords(available);
    const remaining = attempts.filter(
      (attempt) => !isPlayAttemptCleared(attempt, records),
    );
    return remaining.length === attempts.length ? null : remaining;
  });
}
