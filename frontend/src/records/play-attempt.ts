import type { PlayRecord } from "@/records/play-record";

/**
 * プレイを始めたときの条件。完了記録と同じ意味の難易度と問題識別情報で、
 * 難易度は完了記録の比較キーと同じ値になる。
 */
export type PlayAttemptStart = {
  difficulty: string;
  problemIdentity: Readonly<Record<string, unknown>>;
};

/** 離れた時点までの実測値。経過時間や操作回数を、名前付きの0以上の数値で持つ。 */
export type PlayAttemptProgress = Readonly<Record<string, number>>;

export type PlayAttemptAbandonment = {
  abandonedAt: number;
  progress: PlayAttemptProgress;
};

/**
 * 始めたプレイ（プレイ試行）の記録。完了したかどうかは持たず、
 * 同じゲームで同じ時刻に始めた完了記録があるかから導出する。
 * `abandonment` は利用者が明示的にプレイを離れたときだけ持つ。
 */
export type PlayAttempt = {
  gameId: string;
  startedAt: number;
  start: PlayAttemptStart;
  abandonment: PlayAttemptAbandonment | null;
};

export type AbandonedPlayAttempt = PlayAttempt & {
  abandonment: PlayAttemptAbandonment;
};

type PlayStartKey = Pick<PlayAttempt, "gameId" | "startedAt">;

/** 同じゲームで同じ時刻に始めたプレイか。試行どうし、試行と完了記録の突き合わせに使う。 */
export function isSamePlayStart(left: PlayStartKey, right: PlayStartKey) {
  return left.gameId === right.gameId && left.startedAt === right.startedAt;
}

/** 完了記録がある試行はクリアとし、離脱を記録していても完了を優先する。 */
export function isPlayAttemptCleared(
  attempt: PlayAttempt,
  records: readonly PlayRecord[],
): boolean {
  return records.some((record) => isSamePlayStart(record, attempt));
}

/** 状態が離脱の試行だけを選ぶ。完了記録がある試行は離脱を記録していてもクリアとして除く。 */
export function getAbandonedPlayAttempts(
  attempts: readonly PlayAttempt[],
  records: readonly PlayRecord[],
): AbandonedPlayAttempt[] {
  return attempts.filter(
    (attempt): attempt is AbandonedPlayAttempt =>
      attempt.abandonment !== null && !isPlayAttemptCleared(attempt, records),
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlayAttemptStart(value: unknown): value is PlayAttemptStart {
  return (
    isObject(value) &&
    typeof value.difficulty === "string" &&
    isObject(value.problemIdentity)
  );
}

function isPlayAttemptAbandonment(
  value: unknown,
  startedAt: number,
): value is PlayAttemptAbandonment {
  return (
    isObject(value) &&
    isFiniteNumber(value.abandonedAt) &&
    value.abandonedAt >= startedAt &&
    isObject(value.progress) &&
    Object.values(value.progress).every(
      (progress) => isFiniteNumber(progress) && progress >= 0,
    )
  );
}

export function isPlayAttempt(value: unknown): value is PlayAttempt {
  return (
    isObject(value) &&
    typeof value.gameId === "string" &&
    value.gameId.length > 0 &&
    isFiniteNumber(value.startedAt) &&
    isPlayAttemptStart(value.start) &&
    (value.abandonment === null ||
      isPlayAttemptAbandonment(value.abandonment, value.startedAt))
  );
}
