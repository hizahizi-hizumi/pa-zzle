import type { PlayRecord } from "@/features/records/play-record";
import type { ProblemIdentity } from "@/games/problem-id";
import {
  isFiniteNumber,
  isNonNegativeFiniteNumber,
  isRecordObject,
} from "@/lib/type-guards";

/** 難易度と問題識別情報は完了記録と同じ意味で、難易度は完了記録の比較キーと同じ値になる。 */
export type PlayAttemptStart = {
  difficulty: string;
  problemIdentity: ProblemIdentity;
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

export function isSamePlayStart(left: PlayStartKey, right: PlayStartKey) {
  return left.gameId === right.gameId && left.startedAt === right.startedAt;
}

export function isPlayAttemptCleared(
  attempt: PlayAttempt,
  records: readonly PlayRecord[],
): boolean {
  return records.some((record) => isSamePlayStart(record, attempt));
}

function toPlayStartKey({ gameId, startedAt }: PlayStartKey): string {
  return `${startedAt}:${gameId}`;
}

export function getAbandonedPlayAttempts(
  attempts: readonly PlayAttempt[],
  records: readonly PlayRecord[],
): AbandonedPlayAttempt[] {
  // 記録が数千件あっても試行ごとに全記録を探さないよう、完了したプレイの開始を先にまとめる。
  const clearedStarts = new Set(records.map(toPlayStartKey));
  return attempts.filter(
    (attempt): attempt is AbandonedPlayAttempt =>
      attempt.abandonment !== null &&
      !clearedStarts.has(toPlayStartKey(attempt)),
  );
}

function isPlayAttemptStart(value: unknown): value is PlayAttemptStart {
  return (
    isRecordObject(value) &&
    typeof value.difficulty === "string" &&
    isRecordObject(value.problemIdentity)
  );
}

function isPlayAttemptAbandonment(
  value: unknown,
  startedAt: number,
): value is PlayAttemptAbandonment {
  return (
    isRecordObject(value) &&
    isFiniteNumber(value.abandonedAt) &&
    value.abandonedAt >= startedAt &&
    isRecordObject(value.progress) &&
    Object.values(value.progress).every(isNonNegativeFiniteNumber)
  );
}

export function isPlayAttempt(value: unknown): value is PlayAttempt {
  return (
    isRecordObject(value) &&
    typeof value.gameId === "string" &&
    value.gameId.length > 0 &&
    isFiniteNumber(value.startedAt) &&
    isPlayAttemptStart(value.start) &&
    (value.abandonment === null ||
      isPlayAttemptAbandonment(value.abandonment, value.startedAt))
  );
}
