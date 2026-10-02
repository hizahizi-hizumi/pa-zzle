import {
  parseWaterSortDifficulty,
  type WaterSortDifficulty,
} from "@/games/water-sort/difficulty";
import { waterSortPlayRecordDefinition } from "@/games/water-sort/play-record";
import {
  isWaterSortProblemIdentity,
  type WaterSortProblemIdentity,
} from "@/games/water-sort/problem/problem";
import {
  getWaterSortSessionElapsedMs,
  type WaterSortSession,
} from "@/games/water-sort/session/session";
import {
  createPlayAttemptId,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import type { PlayAttemptDefinition } from "@/records/play-attempt-definition";

const WATER_SORT_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type WaterSortPlayAttemptStart = {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値と、クリアの評価にだけ使うクリアまでの手数・最短手数は保存しない。 */
type WaterSortPlayAttemptProgress = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
};

type WaterSortPlayAttempt = PlayAttempt & {
  payloadVersion: typeof WATER_SORT_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: WaterSortPlayAttemptStart;
  abandonment:
    | (PlayAttemptAbandonment & { progress: WaterSortPlayAttemptProgress })
    | null;
};

type CreateWaterSortPlayAttemptInput = {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  startedAt: number;
};

export function createWaterSortPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateWaterSortPlayAttemptInput): WaterSortPlayAttempt {
  const gameId = waterSortPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: WATER_SORT_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createWaterSortPlayAttemptProgress(
  session: WaterSortSession,
  abandonedAt: number,
): WaterSortPlayAttemptProgress {
  return {
    elapsedMs: getWaterSortSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isWaterSortPlayAttemptStart(
  value: unknown,
): value is WaterSortPlayAttemptStart {
  if (!value || typeof value !== "object") {
    return false;
  }

  const start = value as Partial<
    Record<keyof WaterSortPlayAttemptStart, unknown>
  >;
  return (
    typeof start.difficulty === "string" &&
    parseWaterSortDifficulty(start.difficulty) !== undefined &&
    isWaterSortProblemIdentity(start.problemIdentity)
  );
}

function isWaterSortPlayAttemptProgress(
  value: unknown,
): value is WaterSortPlayAttemptProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const progress = value as Partial<WaterSortPlayAttemptProgress>;
  return (
    typeof progress.elapsedMs === "number" &&
    Number.isFinite(progress.elapsedMs) &&
    progress.elapsedMs >= 0 &&
    isNonNegativeInteger(progress.moveCount) &&
    isNonNegativeInteger(progress.undoCount) &&
    isNonNegativeInteger(progress.restartCount)
  );
}

/** 保存済みの試行を、今のアプリが読める開始条件と進み具合を持つウォーターソートの試行として読む。 */
export function isWaterSortPlayAttempt(
  attempt: PlayAttempt,
): attempt is WaterSortPlayAttempt {
  return (
    attempt.gameId === waterSortPlayRecordDefinition.gameId &&
    attempt.payloadVersion === WATER_SORT_PLAY_ATTEMPT_PAYLOAD_VERSION &&
    isWaterSortPlayAttemptStart(attempt.start) &&
    (attempt.abandonment === null ||
      isWaterSortPlayAttemptProgress(attempt.abandonment.progress))
  );
}

function getWaterSortAbandonedProgress(
  attempt: PlayAttempt,
): WaterSortPlayAttemptProgress | null {
  return isWaterSortPlayAttempt(attempt)
    ? (attempt.abandonment?.progress ?? null)
    : null;
}

type WaterSortPlayAttemptProgressId = "elapsed-ms" | "move-count";

export const waterSortPlayAttemptDefinition = {
  gameId: waterSortPlayRecordDefinition.gameId,
  isAttempt: isWaterSortPlayAttempt,
  getComparisonKey(attempt) {
    return isWaterSortPlayAttempt(attempt) ? attempt.start.difficulty : null;
  },
  progress: [
    {
      id: "elapsed-ms",
      getValue(attempt) {
        return getWaterSortAbandonedProgress(attempt)?.elapsedMs ?? null;
      },
    },
    {
      id: "move-count",
      getValue(attempt) {
        return getWaterSortAbandonedProgress(attempt)?.moveCount ?? null;
      },
    },
  ],
} satisfies PlayAttemptDefinition<WaterSortPlayAttemptProgressId>;
