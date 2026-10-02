import {
  parseTakuzuDifficulty,
  type TakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import { takuzuPlayRecordDefinition } from "@/games/takuzu/play-record";
import {
  isTakuzuRecordedProblemIdentity,
  type TakuzuProblemIdentity,
  type TakuzuRecordedProblemIdentity,
} from "@/games/takuzu/problem/problem";
import {
  getTakuzuSessionCorrectionCount,
  getTakuzuSessionElapsedMs,
  type TakuzuSession,
} from "@/games/takuzu/session/session";
import {
  createPlayAttemptId,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import type { PlayAttemptDefinition } from "@/records/play-attempt-definition";

const TAKUZU_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。今と違う版の生成器の識別情報も読み戻す。 */
type TakuzuPlayAttemptStart = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuRecordedProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値は保存しない。 */
type TakuzuPlayAttemptProgress = {
  elapsedMs: number;
  correctionCount: number;
  restartCount: number;
  undoCount: number;
  inputCount: number;
};

type TakuzuPlayAttempt = PlayAttempt & {
  payloadVersion: typeof TAKUZU_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: TakuzuPlayAttemptStart;
  abandonment:
    | (PlayAttemptAbandonment & { progress: TakuzuPlayAttemptProgress })
    | null;
};

type CreateTakuzuPlayAttemptInput = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  startedAt: number;
};

export function createTakuzuPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateTakuzuPlayAttemptInput): TakuzuPlayAttempt {
  const gameId = takuzuPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: TAKUZU_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createTakuzuPlayAttemptProgress(
  session: TakuzuSession,
  abandonedAt: number,
): TakuzuPlayAttemptProgress {
  return {
    elapsedMs: getTakuzuSessionElapsedMs(session, abandonedAt),
    correctionCount: getTakuzuSessionCorrectionCount(session),
    restartCount: session.restartCount,
    undoCount: session.undoCount,
    inputCount: session.inputCount,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isTakuzuPlayAttemptStart(
  value: unknown,
): value is TakuzuPlayAttemptStart {
  if (!value || typeof value !== "object") {
    return false;
  }

  const start = value as Partial<Record<keyof TakuzuPlayAttemptStart, unknown>>;
  return (
    typeof start.difficulty === "string" &&
    parseTakuzuDifficulty(start.difficulty) !== undefined &&
    isTakuzuRecordedProblemIdentity(start.problemIdentity)
  );
}

function isTakuzuPlayAttemptProgress(
  value: unknown,
): value is TakuzuPlayAttemptProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const progress = value as Partial<TakuzuPlayAttemptProgress>;
  return (
    typeof progress.elapsedMs === "number" &&
    Number.isFinite(progress.elapsedMs) &&
    progress.elapsedMs >= 0 &&
    isNonNegativeInteger(progress.correctionCount) &&
    isNonNegativeInteger(progress.restartCount) &&
    isNonNegativeInteger(progress.undoCount) &&
    isNonNegativeInteger(progress.inputCount)
  );
}

/** 保存済みの試行を、今のアプリが読める開始条件と進み具合を持つバイナリパズルの試行として読む。 */
export function isTakuzuPlayAttempt(
  attempt: PlayAttempt,
): attempt is TakuzuPlayAttempt {
  return (
    attempt.gameId === takuzuPlayRecordDefinition.gameId &&
    attempt.payloadVersion === TAKUZU_PLAY_ATTEMPT_PAYLOAD_VERSION &&
    isTakuzuPlayAttemptStart(attempt.start) &&
    (attempt.abandonment === null ||
      isTakuzuPlayAttemptProgress(attempt.abandonment.progress))
  );
}

function getTakuzuAbandonedProgress(
  attempt: PlayAttempt,
): TakuzuPlayAttemptProgress | null {
  return isTakuzuPlayAttempt(attempt)
    ? (attempt.abandonment?.progress ?? null)
    : null;
}

type TakuzuPlayAttemptProgressId = "elapsed-ms" | "correction-count";

export const takuzuPlayAttemptDefinition = {
  gameId: takuzuPlayRecordDefinition.gameId,
  isAttempt: isTakuzuPlayAttempt,
  getComparisonKey(attempt) {
    return isTakuzuPlayAttempt(attempt) ? attempt.start.difficulty : null;
  },
  progress: [
    {
      id: "elapsed-ms",
      getValue(attempt) {
        return getTakuzuAbandonedProgress(attempt)?.elapsedMs ?? null;
      },
    },
    {
      id: "correction-count",
      getValue(attempt) {
        return getTakuzuAbandonedProgress(attempt)?.correctionCount ?? null;
      },
    },
  ],
} satisfies PlayAttemptDefinition<TakuzuPlayAttemptProgressId>;
