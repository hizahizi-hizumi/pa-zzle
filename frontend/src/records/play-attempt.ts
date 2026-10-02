import type { PlayRecord } from "@/records/play-record";

/**
 * 利用者が明示的にプレイを離れたときの事実。
 * `progress` はそのときまでの実測値で、内容は `payloadVersion` に沿ってゲームが決める。
 */
export type PlayAttemptAbandonment = {
  abandonedAt: number;
  progress: unknown;
};

/**
 * 始めたプレイ（プレイ試行）の記録。完了したかどうかは持たず、
 * 同じ `gameId`・`startedAt` の完了記録があるかから導出する。
 * - `start`: 開始条件（難易度・問題識別情報など）。内容は `payloadVersion` に沿ってゲームが決める。
 * - `abandonment`: 離脱したときだけ持つ。
 */
export type PlayAttempt = {
  id: string;
  gameId: string;
  startedAt: number;
  payloadVersion: number;
  start: unknown;
  abandonment: PlayAttemptAbandonment | null;
};

/**
 * - `cleared`: 対応する完了記録がある。離脱の記録より優先する。
 * - `abandoned`: 完了記録が無く、離脱を記録した。
 * - `unfinished`: どちらも無い。離脱を記録できないまま終わったプレイを含む。
 */
export type PlayAttemptStatus = "cleared" | "abandoned" | "unfinished";

/** 離脱を記録した試行。 */
export type AbandonedPlayAttempt = PlayAttempt & {
  abandonment: PlayAttemptAbandonment;
};

export function createPlayAttemptId(gameId: string, startedAt: number): string {
  return `${gameId}:${startedAt}`;
}

function isPlayAttemptAbandonment(
  value: unknown,
  startedAt: number,
): value is PlayAttemptAbandonment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const abandonment = value as Partial<PlayAttemptAbandonment>;
  return (
    typeof abandonment.abandonedAt === "number" &&
    Number.isFinite(abandonment.abandonedAt) &&
    abandonment.abandonedAt >= startedAt &&
    Object.hasOwn(abandonment, "progress")
  );
}

export function isPlayAttempt(value: unknown): value is PlayAttempt {
  if (!value || typeof value !== "object") {
    return false;
  }

  const attempt = value as Partial<PlayAttempt>;
  return (
    typeof attempt.id === "string" &&
    attempt.id.length > 0 &&
    typeof attempt.gameId === "string" &&
    attempt.gameId.length > 0 &&
    typeof attempt.startedAt === "number" &&
    Number.isFinite(attempt.startedAt) &&
    typeof attempt.payloadVersion === "number" &&
    Number.isInteger(attempt.payloadVersion) &&
    attempt.payloadVersion > 0 &&
    Object.hasOwn(attempt, "start") &&
    (attempt.abandonment === null ||
      isPlayAttemptAbandonment(attempt.abandonment, attempt.startedAt))
  );
}

/** 同じゲームで同じ時刻に始めたプレイの完了記録を、その試行の完了記録とみなす。 */
export function isPlayRecordOfAttempt(
  record: Pick<PlayRecord, "gameId" | "startedAt">,
  attempt: Pick<PlayAttempt, "gameId" | "startedAt">,
): boolean {
  return (
    record.gameId === attempt.gameId && record.startedAt === attempt.startedAt
  );
}

export function getPlayAttemptStatus(
  attempt: PlayAttempt,
  records: readonly PlayRecord[],
): PlayAttemptStatus {
  if (records.some((record) => isPlayRecordOfAttempt(record, attempt))) {
    return "cleared";
  }

  return attempt.abandonment ? "abandoned" : "unfinished";
}

/** 状態が離脱の試行だけを選ぶ。完了記録がある試行は離脱を記録していてもクリアとして除く。 */
export function getAbandonedPlayAttempts(
  attempts: readonly PlayAttempt[],
  records: readonly PlayRecord[],
): AbandonedPlayAttempt[] {
  return attempts.filter(
    (attempt): attempt is AbandonedPlayAttempt =>
      getPlayAttemptStatus(attempt, records) === "abandoned",
  );
}
