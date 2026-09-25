import {
  parseWaterSortRecordedDifficulty,
  type WaterSortDifficulty,
  type WaterSortRecordedDifficulty,
} from "@/games/water-sort/difficulty";
import type { WaterSortProblemIdentity } from "@/games/water-sort/problem/problem";
import {
  calculateWaterSortMoveDelta,
  calculateWaterSortPlayScore,
  calculateWaterSortTimeDeltaMs,
} from "@/games/water-sort/score";
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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isWaterSortProblemIdentity(
  value: unknown,
): value is WaterSortProblemIdentity {
  if (!value || typeof value !== "object") {
    return false;
  }

  const identity = value as Partial<WaterSortProblemIdentity>;
  const conditions = identity.conditions;
  return (
    identity.generatorVersion === "1" &&
    typeof identity.seed === "string" &&
    !!conditions &&
    typeof conditions === "object" &&
    isPositiveInteger(conditions.colorCount) &&
    conditions.capacity === 4 &&
    isPositiveInteger(conditions.emptyBottleCount) &&
    isPositiveInteger(identity.generationAttempt)
  );
}

function isWaterSortPerformanceV1(
  value: unknown,
): value is WaterSortPlayPerformanceV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const performance = value as Partial<WaterSortPlayPerformanceV1>;
  return (
    typeof performance.elapsedMs === "number" &&
    Number.isFinite(performance.elapsedMs) &&
    performance.elapsedMs >= 0 &&
    isNonNegativeInteger(performance.moveCount) &&
    isNonNegativeInteger(performance.undoCount) &&
    isNonNegativeInteger(performance.restartCount) &&
    isNonNegativeInteger(performance.optimalMoveCount)
  );
}

function isWaterSortPerformance(
  value: unknown,
): value is WaterSortPlayPerformance {
  if (!isWaterSortPerformanceV1(value)) {
    return false;
  }

  const performance = value as Partial<WaterSortPlayPerformance>;
  return (
    isNonNegativeInteger(performance.completionMoveCount) &&
    performance.completionMoveCount <= (performance.moveCount ?? 0)
  );
}

function hasValidPayloadBase(
  payload: Partial<WaterSortPlayRecordPayloadV1>,
): boolean {
  return (
    parseWaterSortRecordedDifficulty(payload.difficulty) !== undefined &&
    isWaterSortProblemIdentity(payload.problemIdentity)
  );
}

export function isWaterSortPlayRecord(
  record: PlayRecord,
): record is RecognizedWaterSortPlayRecord {
  if (
    record.gameId !== WATER_SORT_GAME_ID ||
    !record.payload ||
    typeof record.payload !== "object"
  ) {
    return false;
  }

  const payload = record.payload as Partial<WaterSortPlayRecordPayload>;
  if (!hasValidPayloadBase(payload)) {
    return false;
  }

  if (record.payloadVersion === 1) {
    return isWaterSortPerformanceV1(payload.performance);
  }

  return (
    record.payloadVersion === WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION &&
    isWaterSortPerformance(payload.performance)
  );
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

export const waterSortPlayRecordDefinition: PlayRecordDefinition = {
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
};
