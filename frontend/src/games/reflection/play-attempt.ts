import {
  parseReflectionDifficulty,
  type ReflectionDifficulty,
} from "@/games/reflection/difficulty";
import { reflectionPlayRecordDefinition } from "@/games/reflection/play-record";
import {
  isReflectionRecordedProblemIdentity,
  type ReflectionProblemIdentity,
  type ReflectionRecordedProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  getReflectionSessionElapsedMs,
  type ReflectionSession,
} from "@/games/reflection/session/session";
import {
  createPlayAttemptId,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import type { PlayAttemptDefinition } from "@/records/play-attempt-definition";

const REFLECTION_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。今と違う版の生成器の識別情報も読み戻す。 */
type ReflectionPlayAttemptStart = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionRecordedProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値は保存しない。 */
type ReflectionPlayAttemptProgress = {
  elapsedMs: number;
  relocationCount: number;
  restartCount: number;
  laserCheckCount: number;
  inputCount: number;
};

type ReflectionPlayAttempt = PlayAttempt & {
  payloadVersion: typeof REFLECTION_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: ReflectionPlayAttemptStart;
  abandonment:
    | (PlayAttemptAbandonment & { progress: ReflectionPlayAttemptProgress })
    | null;
};

type CreateReflectionPlayAttemptInput = {
  difficulty: ReflectionDifficulty;
  problemIdentity: ReflectionProblemIdentity;
  startedAt: number;
};

export function createReflectionPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateReflectionPlayAttemptInput): ReflectionPlayAttempt {
  const gameId = reflectionPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: REFLECTION_PLAY_ATTEMPT_PAYLOAD_VERSION,
    start: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
    },
    abandonment: null,
  };
}

export function createReflectionPlayAttemptProgress(
  session: ReflectionSession,
  abandonedAt: number,
): ReflectionPlayAttemptProgress {
  return {
    elapsedMs: getReflectionSessionElapsedMs(session, abandonedAt),
    relocationCount: session.relocationCount,
    restartCount: session.restartCount,
    laserCheckCount: session.laserCheckCount,
    inputCount: session.inputCount,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isReflectionPlayAttemptStart(
  value: unknown,
): value is ReflectionPlayAttemptStart {
  if (!value || typeof value !== "object") {
    return false;
  }

  const start = value as Partial<
    Record<keyof ReflectionPlayAttemptStart, unknown>
  >;
  return (
    typeof start.difficulty === "string" &&
    parseReflectionDifficulty(start.difficulty) !== undefined &&
    isReflectionRecordedProblemIdentity(start.problemIdentity)
  );
}

function isReflectionPlayAttemptProgress(
  value: unknown,
): value is ReflectionPlayAttemptProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const progress = value as Partial<ReflectionPlayAttemptProgress>;
  return (
    typeof progress.elapsedMs === "number" &&
    Number.isFinite(progress.elapsedMs) &&
    progress.elapsedMs >= 0 &&
    isNonNegativeInteger(progress.relocationCount) &&
    isNonNegativeInteger(progress.restartCount) &&
    isNonNegativeInteger(progress.laserCheckCount) &&
    isNonNegativeInteger(progress.inputCount)
  );
}

/** 保存済みの試行を、今のアプリが読める開始条件と進み具合を持つリフレクションの試行として読む。 */
export function isReflectionPlayAttempt(
  attempt: PlayAttempt,
): attempt is ReflectionPlayAttempt {
  return (
    attempt.gameId === reflectionPlayRecordDefinition.gameId &&
    attempt.payloadVersion === REFLECTION_PLAY_ATTEMPT_PAYLOAD_VERSION &&
    isReflectionPlayAttemptStart(attempt.start) &&
    (attempt.abandonment === null ||
      isReflectionPlayAttemptProgress(attempt.abandonment.progress))
  );
}

function getReflectionAbandonedProgress(
  attempt: PlayAttempt,
): ReflectionPlayAttemptProgress | null {
  return isReflectionPlayAttempt(attempt)
    ? (attempt.abandonment?.progress ?? null)
    : null;
}

type ReflectionPlayAttemptProgressId = "elapsed-ms";

export const reflectionPlayAttemptDefinition = {
  gameId: reflectionPlayRecordDefinition.gameId,
  isAttempt: isReflectionPlayAttempt,
  getComparisonKey(attempt) {
    return isReflectionPlayAttempt(attempt) ? attempt.start.difficulty : null;
  },
  progress: [
    {
      id: "elapsed-ms",
      getValue(attempt) {
        return getReflectionAbandonedProgress(attempt)?.elapsedMs ?? null;
      },
    },
  ],
} satisfies PlayAttemptDefinition<ReflectionPlayAttemptProgressId>;
