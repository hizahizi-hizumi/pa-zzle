import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

import {
  type ParkingJamDifficulty,
  parseParkingJamDifficulty,
} from "./difficulty";
import type { ParkingJamProblemIdentity } from "./problem/problem";
import { calculateParkingJamPlayScore } from "./score";
import type { ParkingJamSessionResult } from "./session/session";

const PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION = 1;
const PARKING_JAM_GAME_ID = "parking-jam";

type ParkingJamPlayRecordPayload = {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  performance: ParkingJamSessionResult;
};

export type ParkingJamPlayRecord = PlayRecord & {
  gameId: typeof PARKING_JAM_GAME_ID;
  payloadVersion: typeof PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION;
  payload: ParkingJamPlayRecordPayload;
};

type CreateParkingJamPlayRecordInput = {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: ParkingJamSessionResult;
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isFiniteUnitInterval(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isParkingJamProblemIdentity(
  value: unknown,
): value is ParkingJamProblemIdentity {
  if (!value || typeof value !== "object") return false;

  const identity = value as Partial<ParkingJamProblemIdentity>;
  const conditions = identity.conditions;
  return (
    identity.generatorVersion === "1" &&
    typeof identity.seed === "string" &&
    !!conditions &&
    typeof conditions === "object" &&
    isPositiveInteger(conditions.width) &&
    isPositiveInteger(conditions.height) &&
    isPositiveInteger(conditions.vehicleCount) &&
    isNonNegativeInteger(conditions.obstacleCount) &&
    typeof conditions.exitProbability === "number" &&
    Number.isFinite(conditions.exitProbability) &&
    conditions.exitProbability > 0 &&
    conditions.exitProbability <= 1 &&
    isFiniteUnitInterval(conditions.blockingPlacementProbability) &&
    isPositiveInteger(identity.generationAttempt)
  );
}

function isParkingJamPerformance(
  value: unknown,
): value is ParkingJamSessionResult {
  if (!value || typeof value !== "object") return false;

  const performance = value as Partial<ParkingJamSessionResult>;
  return (
    typeof performance.elapsedMs === "number" &&
    Number.isFinite(performance.elapsedMs) &&
    performance.elapsedMs >= 0 &&
    isNonNegativeInteger(performance.moveAttemptCount) &&
    isNonNegativeInteger(performance.successfulMoveCount) &&
    isNonNegativeInteger(performance.failedMoveCount) &&
    isNonNegativeInteger(performance.undoCount) &&
    isNonNegativeInteger(performance.restartCount) &&
    performance.moveAttemptCount ===
      (performance.successfulMoveCount ?? 0) +
        (performance.failedMoveCount ?? 0)
  );
}

export function isParkingJamPlayRecord(
  record: PlayRecord,
): record is ParkingJamPlayRecord {
  if (
    record.gameId !== PARKING_JAM_GAME_ID ||
    record.payloadVersion !== PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION ||
    !record.payload ||
    typeof record.payload !== "object"
  ) {
    return false;
  }

  const payload = record.payload as Partial<ParkingJamPlayRecordPayload>;
  if (
    parseParkingJamDifficulty(payload.difficulty) === undefined ||
    !isParkingJamProblemIdentity(payload.problemIdentity) ||
    !isParkingJamPerformance(payload.performance)
  ) {
    return false;
  }

  return (
    payload.performance.successfulMoveCount ===
    payload.problemIdentity.conditions.vehicleCount
  );
}

export function createParkingJamPlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateParkingJamPlayRecordInput): ParkingJamPlayRecord {
  return {
    id: createPlayRecordId([
      PARKING_JAM_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
      problemIdentity.generationAttempt,
    ]),
    gameId: PARKING_JAM_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      performance: {
        elapsedMs: result.elapsedMs,
        moveAttemptCount: result.moveAttemptCount,
        successfulMoveCount: result.successfulMoveCount,
        failedMoveCount: result.failedMoveCount,
        undoCount: result.undoCount,
        restartCount: result.restartCount,
      },
    },
  };
}

export function getParkingJamPlayRecordScore(
  record: ParkingJamPlayRecord,
): number {
  const { difficulty, performance } = record.payload;
  return calculateParkingJamPlayScore({
    difficulty,
    elapsedMs: performance.elapsedMs,
    failedMoveCount: performance.failedMoveCount,
    undoCount: performance.undoCount,
    restartCount: performance.restartCount,
  }).total;
}

export const parkingJamPlayRecordDefinition: PlayRecordDefinition = {
  gameId: PARKING_JAM_GAME_ID,
  isRecord: isParkingJamPlayRecord,
  getComparisonKey(record) {
    return isParkingJamPlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue(record) {
        return isParkingJamPlayRecord(record)
          ? getParkingJamPlayRecordScore(record)
          : null;
      },
    },
    {
      id: "elapsed-ms",
      direction: "lower",
      getValue(record) {
        return isParkingJamPlayRecord(record)
          ? record.payload.performance.elapsedMs
          : null;
      },
    },
    {
      id: "failed-move-count",
      direction: "lower",
      getValue(record) {
        return isParkingJamPlayRecord(record)
          ? record.payload.performance.failedMoveCount
          : null;
      },
    },
  ],
};
