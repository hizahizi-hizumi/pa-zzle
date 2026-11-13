import { parseDifficultyLevel } from "@/games/difficulty";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import {
  createTakuzuResult,
  type TakuzuResult,
} from "@/games/takuzu/play/use-takuzu-play";
import {
  isCurrentTakuzuProblemIdentity,
  isTakuzuRecordedProblemIdentity,
  isTakuzuSolveWorkload,
  type TakuzuProblemIdentity,
  type TakuzuRecordedProblemIdentity,
  type TakuzuSolveWorkload,
} from "@/games/takuzu/problem/problem";
import {
  calculateTakuzuPlayScore,
  calculateTakuzuTimeDeltaMs,
} from "@/games/takuzu/score";
import type { TakuzuSessionResult } from "@/games/takuzu/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const TAKUZU_GAME_ID = "takuzu";
const TAKUZU_PLAY_RECORD_PAYLOAD_VERSION = 1;

type TakuzuPlayRecordPayload = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuRecordedProblemIdentity;
  workload: TakuzuSolveWorkload;
  performance: TakuzuRecordedPerformance;
};

/** 待ったを入れる前の記録には待ったの回数が無い。その記録は待った0回として読む。 */
type TakuzuRecordedPerformance = Omit<TakuzuSessionResult, "undoCount"> & {
  undoCount?: number;
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

/** 置き直しと待ったは、どちらも1回ごとに1回以上の入力を伴うので、入力回数を超えない。 */
function isTakuzuPerformance(
  value: unknown,
): value is TakuzuRecordedPerformance {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.correctionCount) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.inputCount) &&
    value.correctionCount <= value.inputCount &&
    (value.undoCount === undefined ||
      (isNonNegativeInteger(value.undoCount) &&
        value.undoCount <= value.inputCount))
  );
}

function readTakuzuPerformance(
  performance: TakuzuRecordedPerformance,
): TakuzuSessionResult {
  return { ...performance, undoCount: performance.undoCount ?? 0 };
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
    parseDifficultyLevel(difficulty) !== undefined &&
    isTakuzuRecordedProblemIdentity(problemIdentity) &&
    isTakuzuSolveWorkload(workload) &&
    isTakuzuPerformance(performance)
  );
}

export type TakuzuRecordedResult = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  result: TakuzuResult;
};

export function restoreTakuzuRecordedResult(
  record: PlayRecord,
): TakuzuRecordedResult | null {
  if (
    !isTakuzuPlayRecord(record) ||
    !isCurrentTakuzuProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createTakuzuResult(readTakuzuPerformance(performance), workload),
  };
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
        undoCount: result.undoCount,
        inputCount: result.inputCount,
      },
    },
  };
}

export function getTakuzuPlayRecordScore(record: PlayRecord): number | null {
  if (!isTakuzuPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateTakuzuPlayScore({
    ...readTakuzuPerformance(performance),
    workload,
  }).total;
}

export function getTakuzuPlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isTakuzuPlayRecord(record)) {
    return null;
  }

  const { workload, performance } = record.payload;
  return calculateTakuzuTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export type TakuzuPlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "correction-count";

export const takuzuPlayRecordDefinition = {
  gameId: TAKUZU_GAME_ID,
  isRecord: isTakuzuPlayRecord,
  getComparisonKey(record) {
    return isTakuzuPlayRecord(record) ? record.payload.difficulty : null;
  },
  getClearPerformance(record) {
    return isTakuzuPlayRecord(record)
      ? { elapsedMs: record.payload.performance.elapsedMs }
      : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getTakuzuPlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getTakuzuPlayRecordTimeDelta,
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
} satisfies PlayRecordDefinition<TakuzuPlayRecordMetricId>;
