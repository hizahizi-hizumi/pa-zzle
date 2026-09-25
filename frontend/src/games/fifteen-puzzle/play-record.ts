import {
  type FifteenPuzzleDifficulty,
  parseFifteenPuzzleDifficulty,
} from "@/games/fifteen-puzzle/difficulty";
import {
  type FifteenPuzzleProblemIdentity,
  isFifteenPuzzleProblemIdentity,
} from "@/games/fifteen-puzzle/problem/problem";
import {
  calculateFifteenPuzzleMoveDelta,
  calculateFifteenPuzzlePlayScore,
  calculateFifteenPuzzleTimeDeltaMs,
} from "@/games/fifteen-puzzle/score";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const FIFTEEN_PUZZLE_GAME_ID = "fifteen-puzzle";
const FIFTEEN_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION = 1;

type FifteenPuzzlePlayPerformance = {
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

type FifteenPuzzlePlayRecordPayload = {
  difficulty: FifteenPuzzleDifficulty;
  problemIdentity: FifteenPuzzleProblemIdentity;
  performance: FifteenPuzzlePlayPerformance;
};

type FifteenPuzzlePlayRecord = PlayRecord & {
  gameId: typeof FIFTEEN_PUZZLE_GAME_ID;
  payloadVersion: typeof FIFTEEN_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: FifteenPuzzlePlayRecordPayload;
};

type CreateFifteenPuzzlePlayRecordInput = {
  difficulty: FifteenPuzzleDifficulty;
  problemIdentity: FifteenPuzzleProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: FifteenPuzzlePlayPerformance;
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

function isFifteenPuzzlePerformance(
  value: unknown,
): value is FifteenPuzzlePlayPerformance {
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

export function isFifteenPuzzlePlayRecord(
  record: PlayRecord,
): record is FifteenPuzzlePlayRecord {
  if (
    record.gameId !== FIFTEEN_PUZZLE_GAME_ID ||
    record.payloadVersion !== FIFTEEN_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseFifteenPuzzleDifficulty(difficulty) !== undefined &&
    isFifteenPuzzleProblemIdentity(problemIdentity) &&
    isFifteenPuzzlePerformance(performance)
  );
}

export function createFifteenPuzzlePlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateFifteenPuzzlePlayRecordInput): FifteenPuzzlePlayRecord {
  return {
    id: createPlayRecordId([
      FIFTEEN_PUZZLE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: FIFTEEN_PUZZLE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: FIFTEEN_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION,
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

function getFifteenPuzzlePlayRecordScore(record: PlayRecord): number | null {
  if (!isFifteenPuzzlePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, moveCount, optimalMoveCount } = record.payload.performance;
  return calculateFifteenPuzzlePlayScore({
    elapsedMs,
    moveCount,
    optimalMoveCount,
  }).total;
}

function getFifteenPuzzlePlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isFifteenPuzzlePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, optimalMoveCount } = record.payload.performance;
  return calculateFifteenPuzzleTimeDeltaMs({ elapsedMs, optimalMoveCount });
}

function getFifteenPuzzlePlayRecordMoveDelta(
  record: PlayRecord,
): number | null {
  if (!isFifteenPuzzlePlayRecord(record)) {
    return null;
  }

  const { moveCount, optimalMoveCount } = record.payload.performance;
  return calculateFifteenPuzzleMoveDelta({ moveCount, optimalMoveCount });
}

export const fifteenPuzzlePlayRecordDefinition: PlayRecordDefinition = {
  gameId: FIFTEEN_PUZZLE_GAME_ID,
  isRecord: isFifteenPuzzlePlayRecord,
  getComparisonKey(record) {
    return isFifteenPuzzlePlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getFifteenPuzzlePlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getFifteenPuzzlePlayRecordTimeDelta,
    },
    {
      id: "move-delta",
      direction: "lower",
      getValue: getFifteenPuzzlePlayRecordMoveDelta,
    },
  ],
};

export const _private = {
  getFifteenPuzzlePlayRecordScore,
  getFifteenPuzzlePlayRecordTimeDelta,
  getFifteenPuzzlePlayRecordMoveDelta,
};
