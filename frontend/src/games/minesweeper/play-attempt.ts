import {
  type MinesweeperDifficulty,
  parseMinesweeperDifficulty,
} from "@/games/minesweeper/difficulty";
import { minesweeperPlayRecordDefinition } from "@/games/minesweeper/play-record";
import {
  isMinesweeperProblemIdentity,
  type MinesweeperProblemIdentity,
} from "@/games/minesweeper/problem/problem";
import {
  getMinesweeperSessionElapsedMs,
  type MinesweeperSession,
} from "@/games/minesweeper/session/session";
import {
  createPlayAttemptId,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import type { PlayAttemptDefinition } from "@/records/play-attempt-definition";

const MINESWEEPER_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type MinesweeperPlayAttemptStart = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値と、クリアの評価にだけ使う最小の開く回数は保存しない。 */
type MinesweeperPlayAttemptProgress = {
  elapsedMs: number;
  mistakeCount: number;
};

type MinesweeperPlayAttempt = PlayAttempt & {
  payloadVersion: typeof MINESWEEPER_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: MinesweeperPlayAttemptStart;
  abandonment:
    | (PlayAttemptAbandonment & { progress: MinesweeperPlayAttemptProgress })
    | null;
};

type CreateMinesweeperPlayAttemptInput = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  startedAt: number;
};

export function createMinesweeperPlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateMinesweeperPlayAttemptInput): MinesweeperPlayAttempt {
  const gameId = minesweeperPlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: MINESWEEPER_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createMinesweeperPlayAttemptProgress(
  session: MinesweeperSession,
  abandonedAt: number,
): MinesweeperPlayAttemptProgress {
  return {
    elapsedMs: getMinesweeperSessionElapsedMs(session, abandonedAt),
    mistakeCount: session.mistakeCount,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isMinesweeperPlayAttemptStart(
  value: unknown,
): value is MinesweeperPlayAttemptStart {
  if (!value || typeof value !== "object") {
    return false;
  }

  const start = value as Partial<
    Record<keyof MinesweeperPlayAttemptStart, unknown>
  >;
  return (
    typeof start.difficulty === "string" &&
    parseMinesweeperDifficulty(start.difficulty) !== undefined &&
    isMinesweeperProblemIdentity(start.problemIdentity)
  );
}

function isMinesweeperPlayAttemptProgress(
  value: unknown,
): value is MinesweeperPlayAttemptProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const progress = value as Partial<MinesweeperPlayAttemptProgress>;
  return (
    typeof progress.elapsedMs === "number" &&
    Number.isFinite(progress.elapsedMs) &&
    progress.elapsedMs >= 0 &&
    isNonNegativeInteger(progress.mistakeCount)
  );
}

/** 保存済みの試行を、今のアプリが読める開始条件と進み具合を持つマインスイーパーの試行として読む。 */
export function isMinesweeperPlayAttempt(
  attempt: PlayAttempt,
): attempt is MinesweeperPlayAttempt {
  return (
    attempt.gameId === minesweeperPlayRecordDefinition.gameId &&
    attempt.payloadVersion === MINESWEEPER_PLAY_ATTEMPT_PAYLOAD_VERSION &&
    isMinesweeperPlayAttemptStart(attempt.start) &&
    (attempt.abandonment === null ||
      isMinesweeperPlayAttemptProgress(attempt.abandonment.progress))
  );
}

function getMinesweeperAbandonedProgress(
  attempt: PlayAttempt,
): MinesweeperPlayAttemptProgress | null {
  return isMinesweeperPlayAttempt(attempt)
    ? (attempt.abandonment?.progress ?? null)
    : null;
}

type MinesweeperPlayAttemptProgressId = "elapsed-ms" | "mistake-count";

export const minesweeperPlayAttemptDefinition = {
  gameId: minesweeperPlayRecordDefinition.gameId,
  isAttempt: isMinesweeperPlayAttempt,
  getComparisonKey(attempt) {
    return isMinesweeperPlayAttempt(attempt) ? attempt.start.difficulty : null;
  },
  progress: [
    {
      id: "elapsed-ms",
      getValue(attempt) {
        return getMinesweeperAbandonedProgress(attempt)?.elapsedMs ?? null;
      },
    },
    {
      id: "mistake-count",
      getValue(attempt) {
        return getMinesweeperAbandonedProgress(attempt)?.mistakeCount ?? null;
      },
    },
  ],
} satisfies PlayAttemptDefinition<MinesweeperPlayAttemptProgressId>;
