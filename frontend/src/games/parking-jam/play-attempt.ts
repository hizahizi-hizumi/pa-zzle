import {
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  type ParkingJamDifficulty,
  parseParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import {
  isParkingJamProblemIdentity,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import {
  getParkingJamSessionElapsedMs,
  type ParkingJamSession,
} from "@/games/parking-jam/session/session";
import {
  createPlayAttemptId,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import type { PlayAttemptDefinition } from "@/records/play-attempt-definition";

const PARKING_JAM_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type ParkingJamPlayAttemptStart = {
  difficulty: ParkingJamDifficulty;
  difficultyModelVersion: typeof PARKING_JAM_DIFFICULTY_MODEL_VERSION;
  problemIdentity: ParkingJamProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値は保存しない。 */
type ParkingJamPlayAttemptProgress = {
  elapsedMs: number;
  moveAttemptCount: number;
  successfulMoveCount: number;
  failedMoveCount: number;
  undoCount: number;
  restartCount: number;
};

export type ParkingJamPlayAttempt = PlayAttempt & {
  payloadVersion: typeof PARKING_JAM_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: ParkingJamPlayAttemptStart;
  abandonment:
    | (PlayAttemptAbandonment & { progress: ParkingJamPlayAttemptProgress })
    | null;
};

type CreateParkingJamPlayAttemptInput = {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  startedAt: number;
};

export function createParkingJamPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateParkingJamPlayAttemptInput): ParkingJamPlayAttempt {
  const gameId = parkingJamPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: PARKING_JAM_PLAY_ATTEMPT_PAYLOAD_VERSION,
    start: {
      difficulty,
      difficultyModelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
    },
    abandonment: null,
  };
}

export function createParkingJamPlayAttemptProgress(
  session: ParkingJamSession,
  abandonedAt: number,
): ParkingJamPlayAttemptProgress {
  return {
    elapsedMs: getParkingJamSessionElapsedMs(session, abandonedAt),
    moveAttemptCount: session.moveAttemptCount,
    successfulMoveCount: session.successfulMoveCount,
    failedMoveCount: session.failedMoveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isParkingJamPlayAttemptStart(
  value: unknown,
): value is ParkingJamPlayAttemptStart {
  if (!value || typeof value !== "object") {
    return false;
  }

  const start = value as Partial<
    Record<keyof ParkingJamPlayAttemptStart, unknown>
  >;
  return (
    typeof start.difficulty === "string" &&
    parseParkingJamDifficulty(start.difficulty) !== undefined &&
    start.difficultyModelVersion === PARKING_JAM_DIFFICULTY_MODEL_VERSION &&
    isParkingJamProblemIdentity(start.problemIdentity)
  );
}

function isParkingJamPlayAttemptProgress(
  value: unknown,
): value is ParkingJamPlayAttemptProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const progress = value as Partial<ParkingJamPlayAttemptProgress>;
  return (
    typeof progress.elapsedMs === "number" &&
    Number.isFinite(progress.elapsedMs) &&
    progress.elapsedMs >= 0 &&
    isNonNegativeInteger(progress.moveAttemptCount) &&
    isNonNegativeInteger(progress.successfulMoveCount) &&
    isNonNegativeInteger(progress.failedMoveCount) &&
    isNonNegativeInteger(progress.undoCount) &&
    isNonNegativeInteger(progress.restartCount)
  );
}

/** 保存済みの試行を、今のアプリが読める開始条件と進み具合を持つパーキングジャムの試行として読む。 */
export function isParkingJamPlayAttempt(
  attempt: PlayAttempt,
): attempt is ParkingJamPlayAttempt {
  return (
    attempt.gameId === parkingJamPlayRecordDefinition.gameId &&
    attempt.payloadVersion === PARKING_JAM_PLAY_ATTEMPT_PAYLOAD_VERSION &&
    isParkingJamPlayAttemptStart(attempt.start) &&
    (attempt.abandonment === null ||
      isParkingJamPlayAttemptProgress(attempt.abandonment.progress))
  );
}

function getParkingJamAbandonedProgress(
  attempt: PlayAttempt,
): ParkingJamPlayAttemptProgress | null {
  return isParkingJamPlayAttempt(attempt)
    ? (attempt.abandonment?.progress ?? null)
    : null;
}

export type ParkingJamPlayAttemptProgressId =
  | "elapsed-ms"
  | "failed-move-count";

export const parkingJamPlayAttemptDefinition = {
  gameId: parkingJamPlayRecordDefinition.gameId,
  isAttempt: isParkingJamPlayAttempt,
  getComparisonKey(attempt) {
    return isParkingJamPlayAttempt(attempt) ? attempt.start.difficulty : null;
  },
  progress: [
    {
      id: "elapsed-ms",
      getValue(attempt) {
        return getParkingJamAbandonedProgress(attempt)?.elapsedMs ?? null;
      },
    },
    {
      id: "failed-move-count",
      getValue(attempt) {
        return getParkingJamAbandonedProgress(attempt)?.failedMoveCount ?? null;
      },
    },
  ],
} satisfies PlayAttemptDefinition<ParkingJamPlayAttemptProgressId>;
