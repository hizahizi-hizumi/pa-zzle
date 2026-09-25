import {
  parseSlidePuzzleDifficulty,
  type SlidePuzzleDifficulty,
} from "@/games/slide-puzzle/difficulty";
import {
  isSlidePuzzleProblemIdentity,
  type SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import {
  calculateSlidePuzzleMoveDelta,
  calculateSlidePuzzlePlayScore,
  calculateSlidePuzzleTimeDeltaMs,
} from "@/games/slide-puzzle/score";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const SLIDE_PUZZLE_GAME_ID = "slide-puzzle";
const SLIDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION = 1;

type SlidePuzzlePlayPerformance = {
  elapsedMs: number;
  /** 動いたタイルの総枚数。盤面を戻す前の手も含む。 */
  moveCount: number;
  /** 最後に盤面を戻してから完成までに動いたタイルの枚数。 */
  completionMoveCount: number;
  /** 入力としてのスライド操作の回数。評価には使わない。 */
  slideCount: number;
  restartCount: number;
  optimalMoveCount: number;
};

type SlidePuzzlePlayRecordPayload = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
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

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isSlidePuzzlePerformance(
  value: unknown,
): value is SlidePuzzlePlayPerformance {
  return (
    isRecordObject(value) &&
    typeof value.elapsedMs === "number" &&
    Number.isFinite(value.elapsedMs) &&
    value.elapsedMs >= 0 &&
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
  return (
    typeof difficulty === "string" &&
    parseSlidePuzzleDifficulty(difficulty) !== undefined &&
    isSlidePuzzleProblemIdentity(problemIdentity) &&
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

function getSlidePuzzlePlayRecordScore(record: PlayRecord): number | null {
  if (!isSlidePuzzlePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, moveCount, optimalMoveCount } = record.payload.performance;
  return calculateSlidePuzzlePlayScore({
    elapsedMs,
    moveCount,
    optimalMoveCount,
  }).total;
}

function getSlidePuzzlePlayRecordTimeDelta(record: PlayRecord): number | null {
  if (!isSlidePuzzlePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, optimalMoveCount } = record.payload.performance;
  return calculateSlidePuzzleTimeDeltaMs({ elapsedMs, optimalMoveCount });
}

function getSlidePuzzlePlayRecordMoveDelta(record: PlayRecord): number | null {
  if (!isSlidePuzzlePlayRecord(record)) {
    return null;
  }

  const { moveCount, optimalMoveCount } = record.payload.performance;
  return calculateSlidePuzzleMoveDelta({ moveCount, optimalMoveCount });
}

export const slidePuzzlePlayRecordDefinition: PlayRecordDefinition = {
  gameId: SLIDE_PUZZLE_GAME_ID,
  isRecord: isSlidePuzzlePlayRecord,
  getComparisonKey(record) {
    return isSlidePuzzlePlayRecord(record) ? record.payload.difficulty : null;
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
};

export const _private = {
  getSlidePuzzlePlayRecordScore,
  getSlidePuzzlePlayRecordTimeDelta,
  getSlidePuzzlePlayRecordMoveDelta,
};
