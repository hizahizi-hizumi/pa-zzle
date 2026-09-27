import {
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  type ParkingJamDifficulty,
  parseParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import {
  calculateParkingJamPlayScore,
  calculateParkingJamSpeedFullScoreMs,
  PARKING_JAM_LEGACY_SPEED_FULL_SCORE_MS,
  PARKING_JAM_SCORE_MODEL_VERSION,
  type ParkingJamSpeedReference,
} from "@/games/parking-jam/score";
import type { ParkingJamSessionResult } from "@/games/parking-jam/session/session";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION = 3;
const PARKING_JAM_GAME_ID = "parking-jam";

type ParkingJamProblemFacts = {
  initialBlockedVehicleCount: number;
};

// payloadVersion 2 は play-quality-v1 で採点し、難易度モデル版・採点版を持たない。
type ParkingJamPlayRecordPayloadV2 = {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  performance: ParkingJamSessionResult;
};

type ParkingJamPlayRecordPayload = {
  difficulty: ParkingJamDifficulty;
  difficultyModelVersion: string;
  scoreModelVersion: typeof PARKING_JAM_SCORE_MODEL_VERSION;
  problemIdentity: ParkingJamProblemIdentity;
  problemFacts: ParkingJamProblemFacts;
  performance: ParkingJamSessionResult;
};

type ParkingJamPlayRecordV2 = PlayRecord & {
  gameId: typeof PARKING_JAM_GAME_ID;
  payloadVersion: 2;
  payload: ParkingJamPlayRecordPayloadV2;
};

export type ParkingJamPlayRecord = PlayRecord & {
  gameId: typeof PARKING_JAM_GAME_ID;
  payloadVersion: typeof PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION;
  payload: ParkingJamPlayRecordPayload;
};

type RecognizedParkingJamPlayRecord =
  | ParkingJamPlayRecordV2
  | ParkingJamPlayRecord;

type CreateParkingJamPlayRecordInput = {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  speedReference: ParkingJamSpeedReference;
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
    identity.generatorVersion === "2" &&
    typeof identity.seed === "string" &&
    !!conditions &&
    typeof conditions === "object" &&
    isPositiveInteger(conditions.width) &&
    isPositiveInteger(conditions.height) &&
    isPositiveInteger(conditions.vehicleCount) &&
    isPositiveInteger(conditions.roadOpeningCount) &&
    isPositiveInteger(conditions.roadOpeningSpan) &&
    isNonNegativeInteger(conditions.fixedAreaCount) &&
    isPositiveInteger(conditions.fixedAreaLength) &&
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

function isParkingJamProblemFacts(
  value: unknown,
  vehicleCount: number,
): value is ParkingJamProblemFacts {
  if (!value || typeof value !== "object") return false;

  const facts = value as Partial<ParkingJamProblemFacts>;
  return (
    isNonNegativeInteger(facts.initialBlockedVehicleCount) &&
    facts.initialBlockedVehicleCount < vehicleCount
  );
}

function hasValidPayloadBase<
  Payload extends Partial<ParkingJamPlayRecordPayloadV2>,
>(payload: Payload): payload is Payload & ParkingJamPlayRecordPayloadV2 {
  return (
    parseParkingJamDifficulty(payload.difficulty) !== undefined &&
    isParkingJamProblemIdentity(payload.problemIdentity) &&
    isParkingJamPerformance(payload.performance) &&
    payload.performance.successfulMoveCount ===
      payload.problemIdentity.conditions.vehicleCount
  );
}

export function isParkingJamPlayRecord(
  record: PlayRecord,
): record is RecognizedParkingJamPlayRecord {
  if (
    record.gameId !== PARKING_JAM_GAME_ID ||
    !record.payload ||
    typeof record.payload !== "object"
  ) {
    return false;
  }

  const payload = record.payload as Partial<ParkingJamPlayRecordPayload>;
  if (!hasValidPayloadBase(payload)) return false;

  if (record.payloadVersion === 2) return true;

  return (
    record.payloadVersion === PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION &&
    typeof payload.difficultyModelVersion === "string" &&
    payload.difficultyModelVersion.length > 0 &&
    payload.scoreModelVersion === PARKING_JAM_SCORE_MODEL_VERSION &&
    isParkingJamProblemFacts(
      payload.problemFacts,
      payload.problemIdentity.conditions.vehicleCount,
    )
  );
}

export function createParkingJamPlayRecord({
  difficulty,
  problemIdentity,
  speedReference,
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
      difficultyModelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
      scoreModelVersion: PARKING_JAM_SCORE_MODEL_VERSION,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      problemFacts: {
        initialBlockedVehicleCount: speedReference.initialBlockedVehicleCount,
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

function getSpeedFullScoreMs(record: RecognizedParkingJamPlayRecord): number {
  if (record.payloadVersion === 2) {
    return PARKING_JAM_LEGACY_SPEED_FULL_SCORE_MS[record.payload.difficulty];
  }

  return calculateParkingJamSpeedFullScoreMs({
    vehicleCount: record.payload.problemIdentity.conditions.vehicleCount,
    initialBlockedVehicleCount:
      record.payload.problemFacts.initialBlockedVehicleCount,
  });
}

export function getParkingJamPlayRecordScore(
  record: RecognizedParkingJamPlayRecord,
): number {
  const { performance } = record.payload;
  return calculateParkingJamPlayScore({
    speedFullScoreMs: getSpeedFullScoreMs(record),
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
