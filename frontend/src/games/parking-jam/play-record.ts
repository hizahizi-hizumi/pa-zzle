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
import {
  isParkingJamProblemIdentity,
  isParkingJamRecordedProblemIdentity,
  type ParkingJamProblemIdentity,
  type ParkingJamRecordedProblemIdentity,
} from "@/games/parking-jam/problem/problem";
import {
  calculateParkingJamPlayScore,
  calculateParkingJamTimeDeltaMs,
  PARKING_JAM_SCORE_MODEL_VERSION,
  type ParkingJamSpeedReference,
} from "@/games/parking-jam/score";
import type { ParkingJamSessionResult } from "@/games/parking-jam/session/session";
import {
  isNonEmptyString,
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION = 4;
const PARKING_JAM_GAME_ID = "parking-jam";

type ParkingJamProblemFacts = {
  initialBlockedVehicleCount: number;
};

// payloadVersion 2 は play-quality-v1 で採点し、難易度モデル版・採点版を持たない。
// 今の採点規則の基準時間を求める問題の事実を持たないので、記録一覧に残すだけで評価・自己ベストには使わない。
// payloadVersion 2・3 は3段階（easy / normal / hard）の難易度で、レベル1〜5へ読み替えず旧区分のまま扱う。
// problemIdentity は生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
type ParkingJamPlayRecordPayloadV2 = {
  difficulty: LegacyDifficulty;
  problemIdentity: ParkingJamRecordedProblemIdentity;
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

function isParkingJamPerformance(
  value: unknown,
): value is ParkingJamSessionResult {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.moveAttemptCount) &&
    isNonNegativeInteger(value.successfulMoveCount) &&
    isNonNegativeInteger(value.failedMoveCount) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount) &&
    value.moveAttemptCount === value.successfulMoveCount + value.failedMoveCount
  );
}

function isParkingJamProblemFacts(
  value: unknown,
  vehicleCount: number,
): value is ParkingJamProblemFacts {
  return (
    isRecordObject(value) &&
    isNonNegativeInteger(value.initialBlockedVehicleCount) &&
    value.initialBlockedVehicleCount < vehicleCount
  );
}

export function isParkingJamPlayRecord(
  record: PlayRecord,
): record is RecognizedParkingJamPlayRecord {
  if (
    record.gameId !== PARKING_JAM_GAME_ID ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const {
    difficulty,
    difficultyModelVersion,
    scoreModelVersion,
    problemIdentity,
    problemFacts,
    performance,
  } = record.payload;
  if (
    !isParkingJamRecordedProblemIdentity(problemIdentity) ||
    !isParkingJamPerformance(performance) ||
    // 待ったや盤面を戻す操作で戻した車も再び出庫するため、成功出庫数は車両数以上になる。
    performance.successfulMoveCount < problemIdentity.conditions.vehicleCount
  ) {
    return false;
  }

  const recordedDifficulty =
    typeof difficulty === "string" ? difficulty : undefined;
  const isLegacyDifficultyRecord =
    record.payloadVersion === 2 || record.payloadVersion === 3;
  const hasExpectedDifficulty = isLegacyDifficultyRecord
    ? parseLegacyDifficulty(recordedDifficulty) !== undefined
    : parseDifficultyLevel(recordedDifficulty) !== undefined;
  if (!hasExpectedDifficulty) {
    return false;
  }

  if (record.payloadVersion === 2) {
    return true;
  }

  return (
    (record.payloadVersion === 3 ||
      record.payloadVersion === PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION) &&
    isNonEmptyString(difficultyModelVersion) &&
    scoreModelVersion === PARKING_JAM_SCORE_MODEL_VERSION &&
    isParkingJamProblemFacts(
      problemFacts,
      problemIdentity.conditions.vehicleCount,
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
 * 今の版（レベル1〜5の難易度）の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreParkingJamRecordedResult(
  record: PlayRecord,
): ParkingJamRecordedResult | null {
  if (
    !isParkingJamPlayRecord(record) ||
    record.payloadVersion !== PARKING_JAM_PLAY_RECORD_PAYLOAD_VERSION ||
    !isParkingJamProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createParkingJamResult(performance, getSpeedReference(record)),
  };
}

type EvaluableParkingJamPlayRecord =
  | ParkingJamPlayRecordV3
  | ParkingJamPlayRecord;

function isEvaluableParkingJamPlayRecord(
  record: PlayRecord,
): record is EvaluableParkingJamPlayRecord {
  return isParkingJamPlayRecord(record) && record.payloadVersion !== 2;
}

function getSpeedReference({
  payload,
}: EvaluableParkingJamPlayRecord): ParkingJamSpeedReference {
  return {
    vehicleCount: payload.problemIdentity.conditions.vehicleCount,
    initialBlockedVehicleCount: payload.problemFacts.initialBlockedVehicleCount,
  };
}

/** 今の採点規則で求めた評価点。採点に要る問題の事実を持たない記録は `null`。 */
export function getParkingJamPlayRecordScore(
  record: PlayRecord,
): number | null {
  if (!isEvaluableParkingJamPlayRecord(record)) {
    return null;
  }

  const { performance } = record.payload;
  return calculateParkingJamPlayScore({
    speedReference: getSpeedReference(record),
    elapsedMs: performance.elapsedMs,
    failedMoveCount: performance.failedMoveCount,
    undoCount: performance.undoCount,
    restartCount: performance.restartCount,
  }).total;
}

export function getParkingJamPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isEvaluableParkingJamPlayRecord(record)) {
    return null;
  }

  return calculateParkingJamTimeDeltaMs({
    elapsedMs: record.payload.performance.elapsedMs,
    speedReference: getSpeedReference(record),
  });
}

export type ParkingJamPlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
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
      getValue: getParkingJamPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getParkingJamPlayRecordTimeDelta,
    },
    {
      id: "failed-move-count",
      direction: "lower",
      getValue(record) {
        return isEvaluableParkingJamPlayRecord(record)
          ? record.payload.performance.failedMoveCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<ParkingJamPlayRecordMetricId>;
