import { formatRecordElapsedMs } from "@/records/format";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type {
  PlayRecordDefinition,
  PlayRecordSummary,
} from "@/records/play-record-definition";

import {
  getWaterSortDifficultyLabel,
  parseWaterSortDifficulty,
  type WaterSortDifficulty,
} from "./game/difficulty";
import type { WaterSortProblemIdentity } from "./game/generator";
import { calculateWaterSortPlayScore } from "./game/performance";
import type { WaterSortSessionResult } from "./game/session";

const WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION = 1;
const WATER_SORT_GAME_ID = "water-sort";

type WaterSortPlayPerformance = Pick<
  WaterSortSessionResult,
  "elapsedMs" | "moveCount" | "undoCount" | "restartCount" | "optimalMoveCount"
>;

type WaterSortPlayRecordPayload = {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  performance: WaterSortPlayPerformance;
};

export type WaterSortPlayRecord = PlayRecord & {
  gameId: typeof WATER_SORT_GAME_ID;
  payloadVersion: typeof WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION;
  payload: WaterSortPlayRecordPayload;
};

type CreateWaterSortPlayRecordInput = {
  difficulty: WaterSortDifficulty;
  problemIdentity: WaterSortProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: WaterSortSessionResult;
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
    conditions.emptyBottleCount === 2 &&
    isPositiveInteger(identity.generationAttempt)
  );
}

function isWaterSortPerformance(
  value: unknown,
): value is WaterSortPlayPerformance {
  if (!value || typeof value !== "object") {
    return false;
  }

  const performance = value as Partial<WaterSortPlayPerformance>;
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

export function isWaterSortPlayRecord(
  record: PlayRecord,
): record is WaterSortPlayRecord {
  if (
    record.gameId !== WATER_SORT_GAME_ID ||
    record.payloadVersion !== WATER_SORT_PLAY_RECORD_PAYLOAD_VERSION ||
    !record.payload ||
    typeof record.payload !== "object"
  ) {
    return false;
  }

  const payload = record.payload as Partial<WaterSortPlayRecordPayload>;
  return (
    parseWaterSortDifficulty(payload.difficulty) !== undefined &&
    isWaterSortProblemIdentity(payload.problemIdentity) &&
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
        undoCount: result.undoCount,
        restartCount: result.restartCount,
        optimalMoveCount: result.optimalMoveCount,
      },
    },
  };
}

function getScore(record: WaterSortPlayRecord): number {
  return calculateWaterSortPlayScore(
    record.payload.performance.moveCount,
    record.payload.performance.optimalMoveCount,
  );
}

function getMoveDelta(record: WaterSortPlayRecord): number {
  return (
    record.payload.performance.moveCount -
    record.payload.performance.optimalMoveCount
  );
}

function formatMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `+${moveDelta}`;
}

function getWaterSortPlayRecordSummary(
  record: PlayRecord,
): PlayRecordSummary | null {
  if (!isWaterSortPlayRecord(record)) {
    return null;
  }

  return {
    primaryMetric: {
      label: "プレイ評価",
      value: `${getScore(record)}点`,
    },
    detailMetrics: [
      {
        label: "時間",
        value: formatRecordElapsedMs(record.payload.performance.elapsedMs),
      },
      {
        label: "手数",
        value: String(record.payload.performance.moveCount),
      },
      {
        label: "最短との差",
        value: formatMoveDelta(getMoveDelta(record)),
      },
    ],
  };
}

export const waterSortPlayRecordDefinition: PlayRecordDefinition = {
  gameId: WATER_SORT_GAME_ID,
  gameLabel: "ウォーターソート",
  isRecord: isWaterSortPlayRecord,
  getComparisonGroup(record) {
    return isWaterSortPlayRecord(record)
      ? {
          key: record.payload.difficulty,
          label: getWaterSortDifficultyLabel(record.payload.difficulty),
        }
      : null;
  },
  getSummary: getWaterSortPlayRecordSummary,
  personalBestMetrics: [
    {
      id: "play-score",
      label: "最高評価",
      direction: "higher",
      getValue(record) {
        return isWaterSortPlayRecord(record) ? getScore(record) : null;
      },
      formatValue(value) {
        return `${value}点`;
      },
    },
    {
      id: "elapsed-ms",
      label: "最速",
      direction: "lower",
      getValue(record) {
        return isWaterSortPlayRecord(record)
          ? record.payload.performance.elapsedMs
          : null;
      },
      formatValue: formatRecordElapsedMs,
    },
    {
      id: "move-delta",
      label: "最短との差",
      direction: "lower",
      getValue(record) {
        return isWaterSortPlayRecord(record) ? getMoveDelta(record) : null;
      },
      formatValue: formatMoveDelta,
    },
  ],
};
