import {
  type NanpureDifficulty,
  parseNanpureDifficulty,
} from "@/games/nanpure/difficulty";
import { nanpurePlayRecordDefinition } from "@/games/nanpure/play-record";
import {
  isNanpureRecordedProblemIdentity,
  type NanpureProblemIdentity,
  type NanpureRecordedProblemIdentity,
} from "@/games/nanpure/problem/problem";
import {
  getNanpureSessionElapsedMs,
  type NanpureSession,
} from "@/games/nanpure/session/session";
import {
  createPlayAttemptId,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import type { PlayAttemptDefinition } from "@/records/play-attempt-definition";

const NANPURE_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。今と違う版の生成器の識別情報も読み戻す。 */
type NanpurePlayAttemptStart = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureRecordedProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値は保存しない。 */
type NanpurePlayAttemptProgress = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  restartCount: number;
};

export type NanpurePlayAttempt = PlayAttempt & {
  payloadVersion: typeof NANPURE_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: NanpurePlayAttemptStart;
  abandonment:
    | (PlayAttemptAbandonment & { progress: NanpurePlayAttemptProgress })
    | null;
};

type CreateNanpurePlayAttemptInput = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
  startedAt: number;
};

export function createNanpurePlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateNanpurePlayAttemptInput): NanpurePlayAttempt {
  const gameId = nanpurePlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: NANPURE_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createNanpurePlayAttemptProgress(
  session: NanpureSession,
  abandonedAt: number,
): NanpurePlayAttemptProgress {
  return {
    elapsedMs: getNanpureSessionElapsedMs(session, abandonedAt),
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNanpurePlayAttemptStart(
  value: unknown,
): value is NanpurePlayAttemptStart {
  if (!value || typeof value !== "object") {
    return false;
  }

  const start = value as Partial<
    Record<keyof NanpurePlayAttemptStart, unknown>
  >;
  return (
    typeof start.difficulty === "string" &&
    parseNanpureDifficulty(start.difficulty) !== undefined &&
    isNanpureRecordedProblemIdentity(start.problemIdentity)
  );
}

function isNanpurePlayAttemptProgress(
  value: unknown,
): value is NanpurePlayAttemptProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const progress = value as Partial<NanpurePlayAttemptProgress>;
  return (
    typeof progress.elapsedMs === "number" &&
    Number.isFinite(progress.elapsedMs) &&
    progress.elapsedMs >= 0 &&
    isNonNegativeInteger(progress.mistakeCount) &&
    isNonNegativeInteger(progress.undoCount) &&
    isNonNegativeInteger(progress.restartCount)
  );
}

/** 保存済みの試行を、今のアプリが読める開始条件と進み具合を持つナンプレの試行として読む。 */
export function isNanpurePlayAttempt(
  attempt: PlayAttempt,
): attempt is NanpurePlayAttempt {
  return (
    attempt.gameId === nanpurePlayRecordDefinition.gameId &&
    attempt.payloadVersion === NANPURE_PLAY_ATTEMPT_PAYLOAD_VERSION &&
    isNanpurePlayAttemptStart(attempt.start) &&
    (attempt.abandonment === null ||
      isNanpurePlayAttemptProgress(attempt.abandonment.progress))
  );
}

function getNanpureAbandonedProgress(
  attempt: PlayAttempt,
): NanpurePlayAttemptProgress | null {
  return isNanpurePlayAttempt(attempt)
    ? (attempt.abandonment?.progress ?? null)
    : null;
}

export type NanpurePlayAttemptProgressId = "elapsed-ms" | "mistake-count";

export const nanpurePlayAttemptDefinition = {
  gameId: nanpurePlayRecordDefinition.gameId,
  isAttempt: isNanpurePlayAttempt,
  getComparisonKey(attempt) {
    return isNanpurePlayAttempt(attempt) ? attempt.start.difficulty : null;
  },
  progress: [
    {
      id: "elapsed-ms",
      getValue(attempt) {
        return getNanpureAbandonedProgress(attempt)?.elapsedMs ?? null;
      },
    },
    {
      id: "mistake-count",
      getValue(attempt) {
        return getNanpureAbandonedProgress(attempt)?.mistakeCount ?? null;
      },
    },
  ],
} satisfies PlayAttemptDefinition<NanpurePlayAttemptProgressId>;
