import {
  createPlayRecordId,
  type PlayRecord,
} from "@/features/records/play-record";
import type { PlayRecordDefinition } from "@/features/records/play-record-definition";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import {
  createMagicSquareResult,
  type MagicSquareResult,
} from "@/games/magic-square/play/use-magic-square-play";
import {
  isCurrentMagicSquareProblemIdentity,
  isMagicSquareRecordedProblemIdentity,
  isMagicSquareSolveWorkload,
  type MagicSquareProblemIdentity,
  type MagicSquareRecordedProblemIdentity,
  type MagicSquareSolveWorkload,
} from "@/games/magic-square/problem/problem";
import {
  calculateMagicSquarePlayScore,
  calculateMagicSquareTimeDeltaMs,
} from "@/games/magic-square/score";
import type { MagicSquareSessionResult } from "@/games/magic-square/session/session";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";

const MAGIC_SQUARE_GAME_ID = "magic-square";
const MAGIC_SQUARE_PLAY_RECORD_PAYLOAD_VERSION = 1;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `workload`: 問題集から外れても速さを評価できるよう残す、問題の作業の量。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準との差は保存せず、今の評価規則で導出する。
 */
type MagicSquarePlayRecordPayload = {
  difficulty: MagicSquareDifficulty;
  problemIdentity: MagicSquareRecordedProblemIdentity;
  workload: MagicSquareSolveWorkload;
  performance: MagicSquareSessionResult;
};

export type MagicSquarePlayRecord = PlayRecord & {
  gameId: typeof MAGIC_SQUARE_GAME_ID;
  payloadVersion: typeof MAGIC_SQUARE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: MagicSquarePlayRecordPayload;
};

type CreateMagicSquarePlayRecordInput = {
  difficulty: MagicSquareDifficulty;
  problemIdentity: MagicSquareProblemIdentity;
  workload: MagicSquareSolveWorkload;
  startedAt: number;
  completedAt: number;
  result: MagicSquareSessionResult;
};

function isMagicSquarePerformance(
  value: unknown,
): value is MagicSquareSessionResult {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isNonNegativeInteger(value.withdrawalCount) &&
    isNonNegativeInteger(value.undoCount) &&
    isNonNegativeInteger(value.restartCount)
  );
}

export function isMagicSquarePlayRecord(
  record: PlayRecord,
): record is MagicSquarePlayRecord {
  if (
    record.gameId !== MAGIC_SQUARE_GAME_ID ||
    record.payloadVersion !== MAGIC_SQUARE_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    isMagicSquareRecordedProblemIdentity(problemIdentity) &&
    isMagicSquareSolveWorkload(workload) &&
    isMagicSquarePerformance(performance)
  );
}

export function createMagicSquarePlayRecord({
  difficulty,
  problemIdentity,
  workload,
  startedAt,
  completedAt,
  result,
}: CreateMagicSquarePlayRecordInput): MagicSquarePlayRecord {
  return {
    id: createPlayRecordId([
      MAGIC_SQUARE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: MAGIC_SQUARE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: MAGIC_SQUARE_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      workload: { emptyCellCount: workload.emptyCellCount },
      performance: {
        elapsedMs: result.elapsedMs,
        withdrawalCount: result.withdrawalCount,
        undoCount: result.undoCount,
        restartCount: result.restartCount,
      },
    },
  };
}

export type MagicSquareRecordedResult = {
  difficulty: MagicSquareDifficulty;
  problemIdentity: MagicSquareProblemIdentity;
  result: MagicSquareResult;
};

/** 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。 */
export function restoreMagicSquareRecordedResult(
  record: PlayRecord,
): MagicSquareRecordedResult | null {
  if (
    !isMagicSquarePlayRecord(record) ||
    !isCurrentMagicSquareProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, workload, performance } = record.payload;
  return {
    difficulty,
    problemIdentity,
    result: createMagicSquareResult(performance, workload),
  };
}

function getMagicSquarePlayRecordScore(record: PlayRecord): number | null {
  if (!isMagicSquarePlayRecord(record)) {
    return null;
  }
  const { workload, performance } = record.payload;
  return calculateMagicSquarePlayScore({ ...performance, workload }).total;
}

function getMagicSquarePlayRecordTimeDelta(record: PlayRecord): number | null {
  if (!isMagicSquarePlayRecord(record)) {
    return null;
  }
  const { workload, performance } = record.payload;
  return calculateMagicSquareTimeDeltaMs({
    elapsedMs: performance.elapsedMs,
    workload,
  });
}

export type MagicSquarePlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "withdrawal-count";

export const magicSquarePlayRecordDefinition = {
  gameId: MAGIC_SQUARE_GAME_ID,
  isRecord: isMagicSquarePlayRecord,
  getComparisonKey(record) {
    return isMagicSquarePlayRecord(record) ? record.payload.difficulty : null;
  },
  getClearPerformance(record) {
    return isMagicSquarePlayRecord(record)
      ? { elapsedMs: record.payload.performance.elapsedMs }
      : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getMagicSquarePlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getMagicSquarePlayRecordTimeDelta,
    },
    {
      id: "withdrawal-count",
      direction: "lower",
      getValue(record) {
        return isMagicSquarePlayRecord(record)
          ? record.payload.performance.withdrawalCount
          : null;
      },
    },
  ],
} satisfies PlayRecordDefinition<MagicSquarePlayRecordMetricId>;

export const _private = {
  getMagicSquarePlayRecordScore,
  getMagicSquarePlayRecordTimeDelta,
};
