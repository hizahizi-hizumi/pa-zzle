import {
  parseDifficultyLevel,
  parseRecordedDifficulty,
} from "@/games/difficulty";
import type {
  WaterSortDifficulty,
  WaterSortRecordedDifficulty,
} from "@/games/water-sort/difficulty";
import {
  createWaterSortResult,
  type WaterSortResult,
} from "@/games/water-sort/play/use-water-sort-play";
import {
  isWaterSortProblemIdentity,
  type WaterSortProblemIdentity,
} from "@/games/water-sort/problem/problem";
import {
  calculateWaterSortMoveDelta,
  calculateWaterSortPlayScore,
  calculateWaterSortTimeDeltaMs,
} from "@/games/water-sort/score";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION = 2;
const WATER_SORT_GAME_ID = "water-sort";

type WaterSortPlayPerformanceV1 = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
  optimalMoveCount: number;
};

type WaterSortPlayPerformance = WaterSortPlayPerformanceV1 & {
  completionMoveCount: number;
};

type WaterSortPlayRecordPayloadV1 = {
  difficulty: WaterSortRecordedDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  performance: WaterSortPlayPerformanceV1;
};

type WaterSortPlayRecordPayload = {
  difficulty: WaterSortRecordedDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  performance: WaterSortPlayPerformance;
};

type WaterSortPlayRecordV1 = PlayRecord & {
  gameId: typeof WATER_SORT_GAME_ID;
  payloadVersion: 1;
  payload: WaterSortPlayRecordPayloadV1;
};

export type WaterSortPlayRecord = PlayRecord & {
  gameId: typeof WATER_SORT_GAME_ID;
  payloadVersion: typeof WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION;
  payload: WaterSortPlayRecordPayload;
};

type RecognizedWaterSortPlayRecord =
  | WaterSortPlayRecordV1
  | WaterSortPlayRecord;

type CreateWaterSortPlayRecordInput = {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: WaterSortPlayPerformance;
};

function isWaterSortPerformanceV1(
  value: unknown,
): value is WaterSortPlayPerformanceV1 {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.moveCount) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.optimalMoveCount)
  );
}

function isWaterSortPerformance(
  value: unknown,
): value is WaterSortPlayPerformance {
  return (
    isWaterSortPerformanceV1(value) &&
    "completionMoveCount" in value &&
    isNonNegativeInteger(value.completionMoveCount) &&
    value.completionMoveCount <= value.moveCount
  );
}

export function isWaterSortPlayRecord(
  record: PlayRecord,
): record is RecognizedWaterSortPlayRecord {
  if (record.gameId !== WATER_SORT_GAME_ID || !isRecordObject(record.payload)) {
    return false;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  if (
    typeof difficulty !== "string" ||
    parseRecordedDifficulty(difficulty) === undefined ||
    !isWaterSortProblemIdentity(problemIdentity)
  ) {
    return false;
  }

  if (record.payloadVersion === 1) {
    return isWaterSortPerformanceV1(performance);
  }

  return (
    record.payloadVersion === WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION &&
    isWaterSortPerformance(performance)
  );
}

/** 記録から作り直した、結果画面に出す内容。 */
export type WaterSortRecordedResult = {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  result: WaterSortResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の難易度区分と今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreWaterSortRecordedResult(
  record: PlayRecord,
): WaterSortRecordedResult | null {
  if (
    !isWaterSortPlayRecord(record) ||
    record.payloadVersion !== WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION
  ) {
    return null;
  }

  const difficulty = parseDifficultyLevel(record.payload.difficulty);
  if (difficulty === undefined) {
    return null;
  }

  const { problemIdentity, performance } = record.payload;
  const { optimalMoveCount, ...sessionResult } = performance;
  return {
    difficulty,
    problemIdentity,
    result: createWaterSortResult(
      sessionResult,
      optimalMoveCount,
      problemIdentity.conditions.colorCount,
    ),
  };
}

export function createWaterSortPlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateWaterSortPlayRecordInput): WaterSortPlayRecord {
  return {
    id: createPlayRecordId([
      WATER_SORT_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
      problemIdentity.generationAttempt,
    ]),
    gameId: WATER_SORT_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION,
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
        undoCount: result.undoCount,
        restartCount: result.restartCount,
        optimalMoveCount: result.optimalMoveCount,
      },
    },
  };
}

function getCompletionMoveCount(
  record: RecognizedWaterSortPlayRecord,
): number | null {
  if (record.payloadVersion === WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION) {
    return record.payload.performance.completionMoveCount;
  }

  const { moveCount, undoCount, restartCount } = record.payload.performance;
  return restartCount === 0 ? Math.max(0, moveCount - undoCount) : null;
}

export function getWaterSortPlayRecordCompletionMoveCount(
  record: PlayRecord,
): number | null {
  return isWaterSortPlayRecord(record) ? getCompletionMoveCount(record) : null;
}

export function getWaterSortPlayRecordScore(record: PlayRecord): number | null {
  if (!isWaterSortPlayRecord(record)) {
    return null;
  }

  const completionMoveCount = getCompletionMoveCount(record);
  if (completionMoveCount === null) {
    return null;
  }

  const { elapsedMs, moveCount, optimalMoveCount } = record.payload.performance;
  return calculateWaterSortPlayScore({
    elapsedMs,
    moveCount,
    completionMoveCount,
    optimalMoveCount,
    colorCount: record.payload.problemIdentity.conditions.colorCount,
  }).total;
}

export function getWaterSortPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isWaterSortPlayRecord(record)) {
    return null;
  }

  const { elapsedMs, optimalMoveCount } = record.payload.performance;
  return calculateWaterSortTimeDeltaMs({
    elapsedMs,
    optimalMoveCount,
    colorCount: record.payload.problemIdentity.conditions.colorCount,
  });
}

export function getWaterSortPlayRecordMoveDelta(
  record: PlayRecord,
): number | null {
  if (!isWaterSortPlayRecord(record)) {
    return null;
  }

  const completionMoveCount = getCompletionMoveCount(record);
  if (completionMoveCount === null) {
    return null;
  }

  return calculateWaterSortMoveDelta({
    completionMoveCount,
    optimalMoveCount: record.payload.performance.optimalMoveCount,
  });
}

export type WaterSortPlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "move-delta";

export const waterSortPlayRecordDefinition = {
  gameId: WATER_SORT_GAME_ID,
  isRecord: isWaterSortPlayRecord,
  getComparisonKey(record) {
    return isWaterSortPlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getWaterSortPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getWaterSortPlayRecordTimeDelta,
    },
    {
      id: "move-delta",
      direction: "lower",
      getValue: getWaterSortPlayRecordMoveDelta,
    },
  ],
} satisfies PlayRecordDefinition<WaterSortPlayRecordMetricId>;
