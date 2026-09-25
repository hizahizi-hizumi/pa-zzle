import {
  type NanpureDifficulty,
  parseNanpureDifficulty,
} from "@/games/nanpure/difficulty";
import type { NanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { calculateNanpurePlayScore } from "@/games/nanpure/score";
import type { NanpureSessionResult } from "@/games/nanpure/session/session";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const NANPURE_PLAY_RECORD_PAYLOAD_VERSION = 1;
const NANPURE_GAME_ID = "nanpure";

type NanpurePlayRecordPayload = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
  performance: NanpureSessionResult;
};

export type NanpurePlayRecord = PlayRecord & {
  gameId: typeof NANPURE_GAME_ID;
  payloadVersion: typeof NANPURE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: NanpurePlayRecordPayload;
};

type CreateNanpurePlayRecordInput = {
  difficulty: NanpureDifficulty;
  problemIdentity: NanpureProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: NanpureSessionResult;
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNanpureProblemIdentity(
  value: unknown,
): value is NanpureProblemIdentity {
  if (!value || typeof value !== "object") {
    return false;
  }

  const identity = value as Partial<NanpureProblemIdentity>;
  return (
    identity.generatorVersion === "1" &&
    typeof identity.seed === "string" &&
    !!identity.conditions &&
    typeof identity.conditions === "object" &&
    isNonNegativeInteger(identity.conditions.clueCount) &&
    isPositiveInteger(identity.generationAttempt)
  );
}

function isNanpurePerformance(value: unknown): value is NanpureSessionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const performance = value as Partial<NanpureSessionResult>;
  return (
    typeof performance.elapsedMs === "number" &&
    Number.isFinite(performance.elapsedMs) &&
    performance.elapsedMs >= 0 &&
    isNonNegativeInteger(performance.mistakeCount) &&
    isNonNegativeInteger(performance.undoCount) &&
    isNonNegativeInteger(performance.restartCount)
  );
}

export function isNanpurePlayRecord(
  record: PlayRecord,
): record is NanpurePlayRecord {
  if (
    record.gameId !== NANPURE_GAME_ID ||
    record.payloadVersion !== NANPURE_PLAY_RECORD_PAYLOAD_VERSION ||
    !record.payload ||
    typeof record.payload !== "object"
  ) {
    return false;
  }

  const payload = record.payload as Partial<NanpurePlayRecordPayload>;
  return (
    parseNanpureDifficulty(payload.difficulty) !== undefined &&
    isNanpureProblemIdentity(payload.problemIdentity) &&
    isNanpurePerformance(payload.performance)
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
      problemIdentity.generationAttempt,
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

export function getNanpurePlayRecordScore(record: NanpurePlayRecord): number {
  return calculateNanpurePlayScore(record.payload.performance).total;
}

export const nanpurePlayRecordDefinition: PlayRecordDefinition = {
  gameId: NANPURE_GAME_ID,
  isRecord: isNanpurePlayRecord,
  getComparisonKey(record) {
    return isNanpurePlayRecord(record) ? record.payload.difficulty : null;
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
      id: "elapsed-ms",
      direction: "lower",
      getValue(record) {
        return isNanpurePlayRecord(record)
          ? record.payload.performance.elapsedMs
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
};
