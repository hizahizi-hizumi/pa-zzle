import type { PlayRecord } from "@/features/records/play-record";
import { createPlayRecordId } from "@/features/records/play-record";
import type { PlayRecordDefinition } from "@/features/records/play-record-definition";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import {
  createShuttleParkingResult,
  type ShuttleParkingResult,
} from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import {
  isCurrentShuttleParkingProblemIdentity,
  isShuttleParkingRecordedProblemIdentity,
  type ShuttleParkingProblemIdentity,
  type ShuttleParkingRecordedProblemIdentity,
} from "@/games/shuttle-parking/problem/problem";
import {
  calculateShuttleParkingPlayScore,
  calculateShuttleParkingTimeDeltaMs,
  SHUTTLE_PARKING_SCORE_MODEL_VERSION,
  type ShuttleParkingSpeedReference,
} from "@/games/shuttle-parking/score";
import type { ShuttleParkingSessionResult } from "@/games/shuttle-parking/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

const SHUTTLE_PARKING_PLAY_RECORD_PAYLOAD_VERSION = 1;
const SHUTTLE_PARKING_GAME_ID = "shuttle-parking";

/** 採点の基準時間に使う問題の事実。生成器の版が変わっても記録だけで評価できるよう、問題から写して持つ。 */
type ShuttleParkingProblemFacts = ShuttleParkingSpeedReference;

type ShuttleParkingPlayRecordPayload = {
  difficulty: ShuttleParkingDifficulty;
  scoreModelVersion: typeof SHUTTLE_PARKING_SCORE_MODEL_VERSION;
  problemIdentity: ShuttleParkingRecordedProblemIdentity;
  problemFacts: ShuttleParkingProblemFacts;
  performance: ShuttleParkingSessionResult;
};

export type ShuttleParkingPlayRecord = PlayRecord & {
  gameId: typeof SHUTTLE_PARKING_GAME_ID;
  payloadVersion: typeof SHUTTLE_PARKING_PLAY_RECORD_PAYLOAD_VERSION;
  payload: ShuttleParkingPlayRecordPayload;
};

type CreateShuttleParkingPlayRecordInput = {
  difficulty: ShuttleParkingDifficulty;
  problemIdentity: ShuttleParkingProblemIdentity;
  speedReference: ShuttleParkingSpeedReference;
  startedAt: number;
  completedAt: number;
  result: ShuttleParkingSessionResult;
};

function isShuttleParkingPerformance(
  value: unknown,
  carCount: number,
): value is ShuttleParkingSessionResult {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.exitCount) &&
    isNonNegativeInteger(value.blockedExitCount) &&
    isNonNegativeInteger(value.trapCount) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount) &&
    // 待ったや盤面を戻す操作で戻した車も再び出すため、出庫数は車の数以上になる。
    value.exitCount >= carCount &&
    value.trapCount <= value.exitCount
  );
}

function isShuttleParkingProblemFacts(
  value: unknown,
): value is ShuttleParkingProblemFacts {
  return (
    isRecordObject(value) &&
    isPositiveInteger(value.carCount) &&
    isPositiveInteger(value.passengerCount)
  );
}

export function isShuttleParkingPlayRecord(
  record: PlayRecord,
): record is ShuttleParkingPlayRecord {
  if (
    record.gameId !== SHUTTLE_PARKING_GAME_ID ||
    record.payloadVersion !== SHUTTLE_PARKING_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const {
    difficulty,
    scoreModelVersion,
    problemIdentity,
    problemFacts,
    performance,
  } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    scoreModelVersion === SHUTTLE_PARKING_SCORE_MODEL_VERSION &&
    isShuttleParkingRecordedProblemIdentity(problemIdentity) &&
    isShuttleParkingProblemFacts(problemFacts) &&
    isShuttleParkingPerformance(performance, problemFacts.carCount)
  );
}

export function createShuttleParkingPlayRecord({
  difficulty,
  problemIdentity,
  speedReference,
  startedAt,
  completedAt,
  result,
}: CreateShuttleParkingPlayRecordInput): ShuttleParkingPlayRecord {
  return {
    id: createPlayRecordId([
      SHUTTLE_PARKING_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: SHUTTLE_PARKING_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: SHUTTLE_PARKING_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      scoreModelVersion: SHUTTLE_PARKING_SCORE_MODEL_VERSION,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      problemFacts: {
        carCount: speedReference.carCount,
        passengerCount: speedReference.passengerCount,
      },
      performance: {
        elapsedMs: result.elapsedMs,
        exitCount: result.exitCount,
        blockedExitCount: result.blockedExitCount,
        trapCount: result.trapCount,
        undoCount: result.undoCount,
        restartCount: result.restartCount,
      },
    },
  };
}

export type ShuttleParkingRecordedResult = {
  difficulty: ShuttleParkingDifficulty;
  problemIdentity: ShuttleParkingProblemIdentity;
  result: ShuttleParkingResult;
};

/** 今の生成器の問題の記録のときだけ作れる。それ以外は `null` を返す。 */
export function restoreShuttleParkingRecordedResult(
  record: PlayRecord,
): ShuttleParkingRecordedResult | null {
  if (
    !isShuttleParkingPlayRecord(record) ||
    !isCurrentShuttleParkingProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, problemFacts, performance } =
    record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createShuttleParkingResult(performance, problemFacts),
  };
}

export function getShuttleParkingPlayRecordScore(
  record: PlayRecord,
): number | null {
  if (!isShuttleParkingPlayRecord(record)) {
    return null;
  }

  const { performance, problemFacts } = record.payload;
  return calculateShuttleParkingPlayScore({
    speedReference: problemFacts,
    elapsedMs: performance.elapsedMs,
    trapCount: performance.trapCount,
  }).total;
}

export function getShuttleParkingPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isShuttleParkingPlayRecord(record)) {
    return null;
  }

  return calculateShuttleParkingTimeDeltaMs({
    elapsedMs: record.payload.performance.elapsedMs,
    speedReference: record.payload.problemFacts,
  });
}

export type ShuttleParkingPlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "trap-count";

export const shuttleParkingPlayRecordDefinition = {
  gameId: SHUTTLE_PARKING_GAME_ID,
  isRecord: isShuttleParkingPlayRecord,
  getComparisonKey(record) {
    return isShuttleParkingPlayRecord(record)
      ? record.payload.difficulty
      : null;
  },
  // 車は1台ずつ1回出すので、完成までの手数は問題の車の数で決まり、手数は持たない。
  getClearPerformance(record) {
    if (!isShuttleParkingPlayRecord(record)) {
      return null;
    }
    const { elapsedMs, trapCount } = record.payload.performance;
    return { elapsedMs, mistakeCount: trapCount };
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getShuttleParkingPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getShuttleParkingPlayRecordTimeDelta,
    },
    {
      id: "trap-count",
      direction: "lower",
      getValue(record) {
        return isShuttleParkingPlayRecord(record)
          ? record.payload.performance.trapCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<ShuttleParkingPlayRecordMetricId>;
