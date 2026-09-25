import {
  parseTakuzuDifficulty,
  type TakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import {
  isTakuzuProblemIdentity,
  isTakuzuSolveWorkload,
  type TakuzuProblemIdentity,
  type TakuzuSolveWorkload,
} from "@/games/takuzu/problem/problem";
import {
  calculateTakuzuPlayScore,
  calculateTakuzuTimeDeltaMs,
} from "@/games/takuzu/score";
import type { TakuzuSessionResult } from "@/games/takuzu/session/session";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const TAKUZU_GAME_ID = "takuzu";
const TAKUZU_PLAY_RECORD_PAYLOAD_VERSION = 1;

/**
 * - `workload`: 遊んだ問題を解き切る作業の量。基準時間を記録だけから求め直せるよう、問題の事実として残す。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準時間との差は保存せず、現在の評価規則で導出する。
 */
type TakuzuPlayRecordPayload = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  workload: TakuzuSolveWorkload;
  performance: TakuzuSessionResult;
};

export type TakuzuPlayRecord = PlayRecord & {
  gameId: typeof TAKUZU_GAME_ID;
  payloadVersion: typeof TAKUZU_PLAY_RECORD_PAYLOAD_VERSION;
  payload: TakuzuPlayRecordPayload;
};

type CreateTakuzuPlayRecordInput = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  workload: TakuzuSolveWorkload;
  startedAt: number;
  completedAt: number;
  result: TakuzuSessionResult;
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** 置き直しは1回以上の入力を伴うので、入力回数を超えない。 */
function isTakuzuPerformance(value: unknown): value is TakuzuSessionResult {
  return (
    isRecordObject(value) &&
    typeof value.elapsedMs === "number" &&
    Number.isFinite(value.elapsedMs) &&
    value.elapsedMs >= 0 &&
    isNonNegativeInteger(value.correctionCount) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.inputCount) &&
    value.correctionCount <= value.inputCount
  );
}

export function isTakuzuPlayRecord(
  record: PlayRecord,
): record is TakuzuPlayRecord {
  if (
    record.gameId !== TAKUZU_GAME_ID ||
    record.payloadVersion !== TAKUZU_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseTakuzuDifficulty(difficulty) !== undefined &&
    isTakuzuProblemIdentity(problemIdentity) &&
    isTakuzuSolveWorkload(workload) &&
    isTakuzuPerformance(performance)
  );
}

export function createTakuzuPlayRecord({
  difficulty,
  problemIdentity,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateTakuzuPlayRecordInput): TakuzuPlayRecord {
  return {
    id: createPlayRecordId([
      TAKUZU_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: TAKUZU_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: TAKUZU_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      workload: {
        emptyCellCount: workload.emptyCellCount,
        roundCount: workload.roundCount,
        lineReadingRoundCount: workload.lineReadingRoundCount,
      },
      performance: {
        elapsedMs: result.elapsedMs,
        correctionCount: result.correctionCount,
        restartCount: result.restartCount,
        inputCount: result.inputCount,
      },
    },
  };
}

export function getTakuzuPlayRecordScore(record: TakuzuPlayRecord): number {
  const { workload, performance } = record.payload;
  return calculateTakuzuPlayScore({ ...performance, workload }).total;
}

export function getTakuzuPlayRecordTimeDeltaMs(
  record: TakuzuPlayRecord,
): number {
  const { workload, performance } = record.payload;
  return calculateTakuzuTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export const takuzuPlayRecordDefinition: PlayRecordDefinition = {
  gameId: TAKUZU_GAME_ID,
  isRecord: isTakuzuPlayRecord,
  getComparisonKey(record) {
    return isTakuzuPlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue(record) {
        return isTakuzuPlayRecord(record)
          ? getTakuzuPlayRecordScore(record)
          : null;
      },
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue(record) {
        return isTakuzuPlayRecord(record)
          ? getTakuzuPlayRecordTimeDeltaMs(record)
          : null;
      },
    },
    {
      id: "correction-count",
      direction: "lower",
      getValue(record) {
        return isTakuzuPlayRecord(record)
          ? record.payload.performance.correctionCount
          : null;
      },
    },
  ],
};
