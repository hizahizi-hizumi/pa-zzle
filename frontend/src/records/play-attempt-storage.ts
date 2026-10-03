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

export function readPlayAttempts(
  storage: PlayRecordStorage | null = getDefaultStorage(),
): PlayAttempt[] {
  try {
    const stored = storage?.getItem(PLAY_ATTEMPTS_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isPlayAttempt) : [];
  } catch {
    return [];
  }
}

/**
 * 保存済みの試行を `update` の結果で保存し直す。`update` が `null` を返したら保存し直さない。
 * 保存できなくてもプレイを妨げないよう、失敗は無視する。
 */
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
    return;
  }
}

/** プレイを始めた事実を保存する。同じ試行は重ねて保存しない。 */
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

/** プレイを離れた事実を保存する。離脱を記録済みの試行と、完了記録がある試行には保存しない。 */
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
 * 完了記録がある試行を保存から除く。クリアした試行は完了記録から導出できるので保持しない。
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
