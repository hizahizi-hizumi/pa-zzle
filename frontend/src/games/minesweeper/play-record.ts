import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

import {
  type MinesweeperDifficulty,
  parseMinesweeperDifficulty,
} from "./difficulty";
import {
  MINESWEEPER_GENERATOR_VERSION,
  type MinesweeperProblemIdentity,
} from "./problem/problem";
import {
  calculateMinesweeperPlayScore,
  calculateMinesweeperTimeDeltaMs,
} from "./score";
import type { MinesweeperSessionResult } from "./session/session";

const MINESWEEPER_PLAY_RECORD_PAYLOAD_VERSION = 1;
const MINESWEEPER_GAME_ID = "minesweeper";

type MinesweeperPlayRecordPayload = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  performance: MinesweeperSessionResult;
};

export type MinesweeperPlayRecord = PlayRecord & {
  gameId: typeof MINESWEEPER_GAME_ID;
  payloadVersion: typeof MINESWEEPER_PLAY_RECORD_PAYLOAD_VERSION;
  payload: MinesweeperPlayRecordPayload;
};

type CreateMinesweeperPlayRecordInput = {
  difficulty: MinesweeperDifficulty;
  problemIdentity: MinesweeperProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: MinesweeperSessionResult;
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isMinesweeperProblemIdentity(
  value: unknown,
): value is MinesweeperProblemIdentity {
  if (!value || typeof value !== "object") {
    return false;
  }

  const identity = value as Partial<MinesweeperProblemIdentity>;
  const conditions = identity.conditions;
  return (
    identity.generatorVersion === MINESWEEPER_GENERATOR_VERSION &&
    typeof identity.seed === "string" &&
    !!conditions &&
    typeof conditions === "object" &&
    isPositiveInteger(conditions.rows) &&
    isPositiveInteger(conditions.columns) &&
    isPositiveInteger(conditions.mineCount) &&
    (conditions.startCellPlacement === "random" ||
      conditions.startCellPlacement === "center") &&
    isPositiveInteger(identity.generationAttempt)
  );
}

function isMinesweeperPerformance(
  value: unknown,
): value is MinesweeperSessionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const performance = value as Partial<MinesweeperSessionResult>;
  return (
    typeof performance.elapsedMs === "number" &&
    Number.isFinite(performance.elapsedMs) &&
    performance.elapsedMs >= 0 &&
    isNonNegativeInteger(performance.mistakeCount) &&
    isNonNegativeInteger(performance.minimumOpenCount)
  );
}

export function isMinesweeperPlayRecord(
  record: PlayRecord,
): record is MinesweeperPlayRecord {
  if (
    record.gameId !== MINESWEEPER_GAME_ID ||
    record.payloadVersion !== MINESWEEPER_PLAY_RECORD_PAYLOAD_VERSION ||
    !record.payload ||
    typeof record.payload !== "object"
  ) {
    return false;
  }

  const payload = record.payload as Partial<MinesweeperPlayRecordPayload>;
  return (
    parseMinesweeperDifficulty(payload.difficulty) !== undefined &&
    isMinesweeperProblemIdentity(payload.problemIdentity) &&
    isMinesweeperPerformance(payload.performance)
  );
}

export function createMinesweeperPlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateMinesweeperPlayRecordInput): MinesweeperPlayRecord {
  return {
    id: createPlayRecordId([
      MINESWEEPER_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
      problemIdentity.generationAttempt,
    ]),
    gameId: MINESWEEPER_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: MINESWEEPER_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      performance: {
        elapsedMs: result.elapsedMs,
        mistakeCount: result.mistakeCount,
        minimumOpenCount: result.minimumOpenCount,
      },
    },
  };
}

export function getMinesweeperPlayRecordScore(
  record: PlayRecord,
): number | null {
  if (!isMinesweeperPlayRecord(record)) {
    return null;
  }

  return calculateMinesweeperPlayScore({
    ...record.payload.performance,
    mineCount: record.payload.problemIdentity.conditions.mineCount,
  }).total;
}

export function getMinesweeperPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isMinesweeperPlayRecord(record)) {
    return null;
  }

  const { elapsedMs, minimumOpenCount } = record.payload.performance;
  return calculateMinesweeperTimeDeltaMs({
    elapsedMs,
    minimumOpenCount,
    mineCount: record.payload.problemIdentity.conditions.mineCount,
  });
}

export const minesweeperPlayRecordDefinition: PlayRecordDefinition = {
  gameId: MINESWEEPER_GAME_ID,
  isRecord: isMinesweeperPlayRecord,
  getComparisonKey(record) {
    return isMinesweeperPlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getMinesweeperPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getMinesweeperPlayRecordTimeDelta,
    },
    {
      id: "mistake-count",
      direction: "lower",
      getValue(record) {
        return isMinesweeperPlayRecord(record)
          ? record.payload.performance.mistakeCount
          : null;
      },
    },
  ],
};
