import {
  createPlayRecordId,
  type PlayRecord,
} from "@/features/records/play-record";
import type { PlayRecordDefinition } from "@/features/records/play-record-definition";
import { parseDifficultyLevel } from "@/games/difficulty";
import {
  isSlidePuzzleProblemIdentityOfDifficulty,
  type SlidePuzzleDifficulty,
} from "@/games/slide-puzzle/difficulty";
import {
  createSlidePuzzleResult,
  type SlidePuzzleResult,
} from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import {
  isCurrentSlidePuzzleProblemIdentity,
  isSlidePuzzleRecordedProblemIdentity,
  type SlidePuzzleProblemIdentity,
  type SlidePuzzleRecordedProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import {
  calculateSlidePuzzleMoveDelta,
  calculateSlidePuzzlePlayScore,
  calculateSlidePuzzleTimeDeltaMs,
} from "@/games/slide-puzzle/score";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

const SLIDE_PUZZLE_GAME_ID = "slide-puzzle";
const SLIDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION = 1;

type SlidePuzzlePlayPerformance = {
  elapsedMs: number;
  moveCount: number;
  completionMoveCount: number;
  slideCount: number;
  restartCount: number;
  optimalMoveCount: number;
};

type SlidePuzzlePlayRecordPayload = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleRecordedProblemIdentity;
  performance: SlidePuzzlePlayPerformance;
};

type SlidePuzzlePlayRecord = PlayRecord & {
  gameId: typeof SLIDE_PUZZLE_GAME_ID;
  payloadVersion: typeof SLIDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: SlidePuzzlePlayRecordPayload;
};

type CreateSlidePuzzlePlayRecordInput = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: SlidePuzzlePlayPerformance;
};

function isSlidePuzzlePerformance(
  value: unknown,
): value is SlidePuzzlePlayPerformance {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isPositiveInteger(value.moveCount) &&
    isPositiveInteger(value.completionMoveCount) &&
    value.completionMoveCount <= value.moveCount &&
    isPositiveInteger(value.slideCount) &&
    value.slideCount <= value.moveCount &&
    isNonNegativeInteger(value.restartCount) &&
    isPositiveInteger(value.optimalMoveCount) &&
    value.optimalMoveCount <= value.completionMoveCount
  );
}

function isRecordedIdentityOfDifficulty(
  identity: SlidePuzzleRecordedProblemIdentity,
  difficulty: SlidePuzzleDifficulty,
): boolean {
  return (
    !isCurrentSlidePuzzleProblemIdentity(identity) ||
    isSlidePuzzleProblemIdentityOfDifficulty(identity, difficulty)
  );
}

export function isSlidePuzzlePlayRecord(
  record: PlayRecord,
): record is SlidePuzzlePlayRecord {
  if (
    record.gameId !== SLIDE_PUZZLE_GAME_ID ||
    record.payloadVersion !== SLIDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  const parsedDifficulty =
    typeof difficulty === "string"
      ? parseDifficultyLevel(difficulty)
      : undefined;
  return (
    parsedDifficulty !== undefined &&
    isSlidePuzzleRecordedProblemIdentity(problemIdentity) &&
    isRecordedIdentityOfDifficulty(problemIdentity, parsedDifficulty) &&
    isSlidePuzzlePerformance(performance)
  );
}

export function createSlidePuzzlePlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateSlidePuzzlePlayRecordInput): SlidePuzzlePlayRecord {
  return {
    id: createPlayRecordId([
      SLIDE_PUZZLE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: SLIDE_PUZZLE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: SLIDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      performance: {
        elapsedMs: result.elapsedMs,
        moveCount: result.moveCount,
        completionMoveCount: result.completionMoveCount,
        slideCount: result.slideCount,
        restartCount: result.restartCount,
        optimalMoveCount: result.optimalMoveCount,
      },
    },
  };
}

export type SlidePuzzleRecordedResult = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
  result: SlidePuzzleResult;
};

export function restoreSlidePuzzleRecordedResult(
  record: PlayRecord,
): SlidePuzzleRecordedResult | null {
  if (
    !isSlidePuzzlePlayRecord(record) ||
    !isCurrentSlidePuzzleProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  const { optimalMoveCount, ...sessionResult } = performance;
  return {
    difficulty,
    problemIdentity,
    result: createSlidePuzzleResult(
      sessionResult,
      problemIdentity.conditions.size,
      optimalMoveCount,
    ),
  };
}

function getSlidePuzzlePlayRecordScore(record: PlayRecord): number | null {
  if (!isSlidePuzzlePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, moveCount, optimalMoveCount } = record.payload.performance;
  return calculateSlidePuzzlePlayScore({
    elapsedMs,
    moveCount,
    boardSize: record.payload.problemIdentity.conditions.size,
    optimalMoveCount,
  }).total;
}

function getSlidePuzzlePlayRecordTimeDelta(record: PlayRecord): number | null {
  if (!isSlidePuzzlePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, optimalMoveCount } = record.payload.performance;
  return calculateSlidePuzzleTimeDeltaMs({
    elapsedMs,
    boardSize: record.payload.problemIdentity.conditions.size,
    optimalMoveCount,
  });
}

function getSlidePuzzlePlayRecordMoveDelta(record: PlayRecord): number | null {
  if (!isSlidePuzzlePlayRecord(record)) {
    return null;
  }

  const { moveCount, optimalMoveCount } = record.payload.performance;
  return calculateSlidePuzzleMoveDelta({ moveCount, optimalMoveCount });
}

export type SlidePuzzlePlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "move-delta";

export const slidePuzzlePlayRecordDefinition = {
  gameId: SLIDE_PUZZLE_GAME_ID,
  isRecord: isSlidePuzzlePlayRecord,
  getComparisonKey(record) {
    return isSlidePuzzlePlayRecord(record) ? record.payload.difficulty : null;
  },
  getClearPerformance(record) {
    if (!isSlidePuzzlePlayRecord(record)) {
      return null;
    }
    const { elapsedMs, completionMoveCount, optimalMoveCount } =
      record.payload.performance;
    return {
      elapsedMs,
      moves: { completionMoveCount, optimalMoveCount },
    };
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getSlidePuzzlePlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getSlidePuzzlePlayRecordTimeDelta,
    },
    {
      id: "move-delta",
      direction: "lower",
      getValue: getSlidePuzzlePlayRecordMoveDelta,
    },
  ],
} satisfies PlayRecordDefinition<SlidePuzzlePlayRecordMetricId>;

export const _private = {
  getSlidePuzzlePlayRecordScore,
  getSlidePuzzlePlayRecordTimeDelta,
  getSlidePuzzlePlayRecordMoveDelta,
};
