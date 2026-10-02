import {
  isSlidePuzzleProblemIdentityOfDifficulty,
  parseSlidePuzzleDifficulty,
  type SlidePuzzleDifficulty,
} from "@/games/slide-puzzle/difficulty";
import { slidePuzzlePlayRecordDefinition } from "@/games/slide-puzzle/play-record";
import {
  isSlidePuzzleProblemIdentity,
  type SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import {
  getSlidePuzzleSessionElapsedMs,
  type SlidePuzzleSession,
} from "@/games/slide-puzzle/session/session";
import {
  createPlayAttemptId,
  type PlayAttempt,
  type PlayAttemptAbandonment,
} from "@/records/play-attempt";
import type { PlayAttemptDefinition } from "@/records/play-attempt-definition";

const SLIDE_PUZZLE_PLAY_ATTEMPT_PAYLOAD_VERSION = 1;

/** プレイを始めたときの条件。完了記録と同じく、問題は識別情報で持つ。 */
type SlidePuzzlePlayAttemptStart = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
};

/** 離れたときまでに起きた事実。評価値と、クリアの評価にだけ使う最後に盤面を戻してからの手数・最短手数は保存しない。 */
type SlidePuzzlePlayAttemptProgress = {
  elapsedMs: number;
  moveCount: number;
  slideCount: number;
  restartCount: number;
};

export type SlidePuzzlePlayAttempt = PlayAttempt & {
  payloadVersion: typeof SLIDE_PUZZLE_PLAY_ATTEMPT_PAYLOAD_VERSION;
  start: SlidePuzzlePlayAttemptStart;
  abandonment:
    | (PlayAttemptAbandonment & { progress: SlidePuzzlePlayAttemptProgress })
    | null;
};

type CreateSlidePuzzlePlayAttemptInput = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
  startedAt: number;
};

export function createSlidePuzzlePlayAttempt({
  difficulty,
  problemIdentity,
  startedAt,
}: CreateSlidePuzzlePlayAttemptInput): SlidePuzzlePlayAttempt {
  const gameId = slidePuzzlePlayRecordDefinition.gameId;
  return {
    id: createPlayAttemptId(gameId, startedAt),
    gameId,
    startedAt,
    payloadVersion: SLIDE_PUZZLE_PLAY_ATTEMPT_PAYLOAD_VERSION,
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

export function createSlidePuzzlePlayAttemptProgress(
  session: SlidePuzzleSession,
  abandonedAt: number,
): SlidePuzzlePlayAttemptProgress {
  return {
    elapsedMs: getSlidePuzzleSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    slideCount: session.slideCount,
    restartCount: session.restartCount,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isSlidePuzzlePlayAttemptStart(
  value: unknown,
): value is SlidePuzzlePlayAttemptStart {
  if (!value || typeof value !== "object") {
    return false;
  }

  const start = value as Partial<
    Record<keyof SlidePuzzlePlayAttemptStart, unknown>
  >;
  const difficulty =
    typeof start.difficulty === "string"
      ? parseSlidePuzzleDifficulty(start.difficulty)
      : undefined;
  return (
    difficulty !== undefined &&
    isSlidePuzzleProblemIdentity(start.problemIdentity) &&
    isSlidePuzzleProblemIdentityOfDifficulty(start.problemIdentity, difficulty)
  );
}

function isSlidePuzzlePlayAttemptProgress(
  value: unknown,
): value is SlidePuzzlePlayAttemptProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const progress = value as Partial<SlidePuzzlePlayAttemptProgress>;
  return (
    typeof progress.elapsedMs === "number" &&
    Number.isFinite(progress.elapsedMs) &&
    progress.elapsedMs >= 0 &&
    isNonNegativeInteger(progress.moveCount) &&
    isNonNegativeInteger(progress.slideCount) &&
    isNonNegativeInteger(progress.restartCount)
  );
}

/** 保存済みの試行を、今のアプリが読める開始条件と進み具合を持つスライドパズルの試行として読む。 */
export function isSlidePuzzlePlayAttempt(
  attempt: PlayAttempt,
): attempt is SlidePuzzlePlayAttempt {
  return (
    attempt.gameId === slidePuzzlePlayRecordDefinition.gameId &&
    attempt.payloadVersion === SLIDE_PUZZLE_PLAY_ATTEMPT_PAYLOAD_VERSION &&
    isSlidePuzzlePlayAttemptStart(attempt.start) &&
    (attempt.abandonment === null ||
      isSlidePuzzlePlayAttemptProgress(attempt.abandonment.progress))
  );
}

function getSlidePuzzleAbandonedProgress(
  attempt: PlayAttempt,
): SlidePuzzlePlayAttemptProgress | null {
  return isSlidePuzzlePlayAttempt(attempt)
    ? (attempt.abandonment?.progress ?? null)
    : null;
}

export type SlidePuzzlePlayAttemptProgressId = "elapsed-ms" | "move-count";

export const slidePuzzlePlayAttemptDefinition = {
  gameId: slidePuzzlePlayRecordDefinition.gameId,
  isAttempt: isSlidePuzzlePlayAttempt,
  getComparisonKey(attempt) {
    return isSlidePuzzlePlayAttempt(attempt) ? attempt.start.difficulty : null;
  },
  progress: [
    {
      id: "elapsed-ms",
      getValue(attempt) {
        return getSlidePuzzleAbandonedProgress(attempt)?.elapsedMs ?? null;
      },
    },
    {
      id: "move-count",
      getValue(attempt) {
        return getSlidePuzzleAbandonedProgress(attempt)?.moveCount ?? null;
      },
    },
  ],
} satisfies PlayAttemptDefinition<SlidePuzzlePlayAttemptProgressId>;
