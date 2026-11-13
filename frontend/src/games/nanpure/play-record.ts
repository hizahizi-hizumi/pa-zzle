import {
  type LegacyDifficulty,
  parseDifficultyLevel,
  parseLegacyDifficulty,
} from "@/games/difficulty";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import {
  createNanpureResult,
  type NanpureResult,
} from "@/games/nanpure/play/use-nanpure-play";
import {
  isCurrentNanpureProblemIdentity,
  isNanpureRecordedProblemIdentity,
  type NanpureProblemIdentity,
  type NanpureRecordedProblemIdentity,
} from "@/games/nanpure/problem/problem";
import {
  calculateNanpurePlayScore,
  calculateNanpureTimeDeltaMs,
} from "@/games/nanpure/score";
import type { NanpureSessionResult } from "@/games/nanpure/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const NANPURE_PLAY_RECORD_PAYLOAD_VERSION = 2;
const NANPURE_GAME_ID = "nanpure";

type NanpurePlayRecordPayload = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureRecordedProblemIdentity;
  performance: NanpureSessionResult;
};

// payloadVersion 1 は3段階（easy / normal / hard）の難易度と、ヒント数を指定した生成器（版 "1"）の問題で記録した。
type NanpurePlayRecordPayloadV1 = Omit<
  NanpurePlayRecordPayload,
  "difficulty"
> & {
  difficulty: LegacyDifficulty;
};

type NanpurePlayRecordV1 = PlayRecord & {
  gameId: typeof NANPURE_GAME_ID;
  payloadVersion: 1;
  payload: NanpurePlayRecordPayloadV1;
};

export type NanpurePlayRecord = PlayRecord & {
  gameId: typeof NANPURE_GAME_ID;
  payloadVersion: typeof NANPURE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: NanpurePlayRecordPayload;
};

type RecognizedNanpurePlayRecord = NanpurePlayRecordV1 | NanpurePlayRecord;

type CreateNanpurePlayRecordInput = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: NanpureSessionResult;
};

function isNanpurePerformance(value: unknown): value is NanpureSessionResult {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.mistakeCount) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount)
  );
}

export function isNanpurePlayRecord(
  record: PlayRecord,
): record is RecognizedNanpurePlayRecord {
  if (record.gameId !== NANPURE_GAME_ID || !isRecordObject(record.payload)) {
    return false;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  const recordedDifficulty =
    typeof difficulty === "string" ? difficulty : undefined;
  const hasExpectedDifficulty =
    record.payloadVersion === 1
      ? parseLegacyDifficulty(recordedDifficulty) !== undefined
      : record.payloadVersion === NANPURE_PLAY_RECORD_PAYLOAD_VERSION &&
        parseDifficultyLevel(recordedDifficulty) !== undefined;
  return (
    hasExpectedDifficulty &&
    isNanpureRecordedProblemIdentity(problemIdentity) &&
    isNanpurePerformance(performance)
  );
}

export function createNanpurePlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateNanpurePlayRecordInput): NanpurePlayRecord {
  return {
    id: createPlayRecordId([
      NANPURE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: NANPURE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: NANPURE_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      performance: {
        elapsedMs: result.elapsedMs,
        mistakeCount: result.mistakeCount,
        undoCount: result.undoCount,
        restartCount: result.restartCount,
      },
    },
  };
}

export type NanpureRecordedResult = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
  result: NanpureResult;
};

export function restoreNanpureRecordedResult(
  record: PlayRecord,
): NanpureRecordedResult | null {
  if (
    !isNanpurePlayRecord(record) ||
    record.payloadVersion !== NANPURE_PLAY_RECORD_PAYLOAD_VERSION ||
    !isCurrentNanpureProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createNanpureResult(performance),
  };
}

export function getNanpurePlayRecordScore(
  record: RecognizedNanpurePlayRecord,
): number {
  return calculateNanpurePlayScore(record.payload.performance).total;
}

export type NanpurePlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "mistake-count";

export const nanpurePlayRecordDefinition = {
  gameId: NANPURE_GAME_ID,
  isRecord: isNanpurePlayRecord,
  getComparisonKey(record) {
    return isNanpurePlayRecord(record) ? record.payload.difficulty : null;
  },
  getClearPerformance(record) {
    if (!isNanpurePlayRecord(record)) {
      return null;
    }
    const { elapsedMs, mistakeCount } = record.payload.performance;
    return { elapsedMs, mistakeCount };
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue(record) {
        return isNanpurePlayRecord(record)
          ? getNanpurePlayRecordScore(record)
          : null;
      },
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue(record) {
        return isNanpurePlayRecord(record)
          ? calculateNanpureTimeDeltaMs(record.payload.performance)
          : null;
      },
    },
    {
      id: "mistake-count",
      direction: "lower",
      getValue(record) {
        return isNanpurePlayRecord(record)
          ? record.payload.performance.mistakeCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<NanpurePlayRecordMetricId>;
