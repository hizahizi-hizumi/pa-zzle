import { formatRecordElapsedMs } from "@/records/format";
import type { PlayRecord } from "@/records/play-record";
import { createPlayRecordId } from "@/records/play-record";
import type {
  PlayRecordAdapter,
  PlayRecordHistoryPresentation,
} from "@/records/presentation";

import {
  getNanpureDifficultyLabel,
  type NanpureDifficulty,
  parseNanpureDifficulty,
} from "./difficulty";
import type { NanpureProblemIdentity } from "./problem/problem";
import { calculateNanpurePlayScore } from "./score";
import type { NanpureSessionResult } from "./session/session";

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

function getScore(record: NanpurePlayRecord): number {
  return calculateNanpurePlayScore(record.payload.performance).total;
}

function getNanpureHistoryPresentation(
  record: PlayRecord,
): PlayRecordHistoryPresentation | null {
  if (!isNanpurePlayRecord(record)) {
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
        label: "ミス",
        value: String(record.payload.performance.mistakeCount),
      },
      {
        label: "待った",
        value: String(record.payload.performance.undoCount),
      },
      {
        label: "やり直し",
        value: String(record.payload.performance.restartCount),
      },
    ],
  };
}

export const nanpurePlayRecordAdapter: PlayRecordAdapter = {
  gameId: NANPURE_GAME_ID,
  gameLabel: "ナンプレ",
  isRecord: isNanpurePlayRecord,
  getComparisonKey(record) {
    return isNanpurePlayRecord(record) ? record.payload.difficulty : null;
  },
  getComparisonLabel(record) {
    return isNanpurePlayRecord(record)
      ? getNanpureDifficultyLabel(record.payload.difficulty)
      : null;
  },
  getHistoryPresentation: getNanpureHistoryPresentation,
  personalBestMetrics: [
    {
      id: "play-score",
      label: "最高評価",
      direction: "higher",
      getValue(record) {
        return isNanpurePlayRecord(record) ? getScore(record) : null;
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
        return isNanpurePlayRecord(record)
          ? record.payload.performance.elapsedMs
          : null;
      },
      formatValue: formatRecordElapsedMs,
    },
    {
      id: "mistake-count",
      label: "最少ミス",
      direction: "lower",
      getValue(record) {
        return isNanpurePlayRecord(record)
          ? record.payload.performance.mistakeCount
          : null;
      },
      formatValue(value) {
        return `${value}回`;
      },
    },
  ],
};
