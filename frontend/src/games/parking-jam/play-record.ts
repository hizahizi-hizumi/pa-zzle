import {
  type LegacyDifficulty,
  parseDifficultyLevel,
  parseLegacyDifficulty,
} from "@/games/difficulty";
import {
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  type ParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import {
  createParkingJamResult,
  type ParkingJamResult,
} from "@/games/parking-jam/play/use-parking-jam-play";
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

const PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION = 4;
const PARKING_JAM_GAME_ID = "parking-jam";

type ParkingJamProblemFacts = {
  initialBlockedVehicleCount: number;
};

// payloadVersion 2 は play-quality-v1 で採点し、難易度モデル版・採点版を持たない。
// payloadVersion 2・3 は3段階（easy / normal / hard）の難易度で、レベル1〜5へ読み替えず旧区分のまま扱う。
type ParkingJamPlayRecordPayloadV2 = {
  difficulty: LegacyDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  performance: ParkingJamSessionResult;
};

type ParkingJamPlayRecordPayloadV3 = ParkingJamPlayRecordPayloadV2 & {
  difficultyModelVersion: string;
  scoreModelVersion: typeof PARKING_JAM_SCORE_MODEL_VERSION;
  problemFacts: ParkingJamProblemFacts;
};

type ParkingJamPlayRecordPayload = Omit<
  ParkingJamPlayRecordPayloadV3,
  "difficulty"
> & {
  difficulty: ParkingJamDifficulty;
};

type ParkingJamPlayRecordV2 = PlayRecord & {
  gameId: typeof PARKING_JAM_GAME_ID;
  payloadVersion: 2;
  payload: ParkingJamPlayRecordPayloadV2;
};

type ParkingJamPlayRecordV3 = PlayRecord & {
  gameId: typeof PARKING_JAM_GAME_ID;
  payloadVersion: 3;
  payload: ParkingJamPlayRecordPayloadV3;
};

export type ParkingJamPlayRecord = PlayRecord & {
  gameId: typeof PARKING_JAM_GAME_ID;
  payloadVersion: typeof PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION;
  payload: ParkingJamPlayRecordPayload;
};

type RecognizedParkingJamPlayRecord =
  | ParkingJamPlayRecordV2
  | ParkingJamPlayRecordV3
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

type ParkingJamPlayRecordPayloadBase = Omit<
  ParkingJamPlayRecordPayloadV2,
  "difficulty"
>;

function hasValidPayloadBase<
  Payload extends Partial<ParkingJamPlayRecordPayloadBase>,
>(payload: Payload): payload is Payload & ParkingJamPlayRecordPayloadBase {
  return (
    isParkingJamProblemIdentity(payload.problemIdentity) &&
    isParkingJamPerformance(payload.performance) &&
    // 待った・やり直しで戻した車も再び出庫するため、成功出庫数は車両数以上になる。
    payload.performance.successfulMoveCount >=
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

  const payload = record.payload as Partial<ParkingJamPlayRecordPayloadV3> &
    Partial<Pick<ParkingJamPlayRecordPayload, "difficulty">>;
  if (!hasValidPayloadBase(payload)) return false;

  const isLegacyDifficultyRecord =
    record.payloadVersion === 2 || record.payloadVersion === 3;
  const hasExpectedDifficulty = isLegacyDifficultyRecord
    ? parseLegacyDifficulty(payload.difficulty) !== undefined
    : parseDifficultyLevel(payload.difficulty) !== undefined;
  if (!hasExpectedDifficulty) return false;

  if (record.payloadVersion === 2) return true;

  return (
    (record.payloadVersion === 3 ||
      record.payloadVersion === PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION) &&
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

/** 記録から作り直した、結果画面に出す内容。 */
export type ParkingJamRecordedResult = {
  difficulty: ParkingJamDifficulty;
  problemIdentity: ParkingJamProblemIdentity;
  result: ParkingJamResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版（レベル1〜5の難易度）の記録のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreParkingJamRecordedResult(
  record: PlayRecord,
): ParkingJamRecordedResult | null {
  if (
    !isParkingJamPlayRecord(record) ||
    record.payloadVersion !== PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION
  ) {
    return null;
  }

  const { difficulty, problemIdentity, problemFacts, performance } =
    record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createParkingJamResult(performance, problemIdentity, {
      vehicleCount: problemIdentity.conditions.vehicleCount,
      initialBlockedVehicleCount: problemFacts.initialBlockedVehicleCount,
    }),
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

export type ParkingJamPlayRecordMetricId =
  | "play-score"
  | "elapsed-ms"
  | "failed-move-count";

export const parkingJamPlayRecordDefinition = {
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
} satisfies PlayRecordDefinition<ParkingJamPlayRecordMetricId>;
