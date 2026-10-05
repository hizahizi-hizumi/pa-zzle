import { parseDifficultyLevel } from "@/games/difficulty";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import {
  createTakuzuResult,
  type TakuzuResult,
} from "@/games/takuzu/play/use-takuzu-play";
import {
  isTakuzuProblemIdentity,
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
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const TAKUZU_GAME_ID = "takuzu";
const TAKUZU_PLAY_RECORD_PAYLOAD_VERSION = 1;

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `workload`: 遊んだ問題を解き切る作業の量。問題集から問題を引けない記録でも基準時間を求め直せるよう、問題の事実として残す。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準時間との差は保存せず、現在の評価規則で導出する。
 */
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

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** 置き直しと待ったは、どちらも1回ごとに1回以上の入力を伴うので、入力回数を超えない。 */
function isTakuzuPerformance(
  value: unknown,
): value is TakuzuRecordedPerformance {
  return (
    isRecordObject(value) &&
    typeof value.elapsedMs === "number" &&
    Number.isFinite(value.elapsedMs) &&
    value.elapsedMs >= 0 &&
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

/** 記録から作り直した、結果画面に出す内容。 */
export type TakuzuRecordedResult = {
  difficulty: TakuzuDifficulty;
  problemIdentity: TakuzuProblemIdentity;
  result: TakuzuResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreTakuzuRecordedResult(
  record: PlayRecord,
): TakuzuRecordedResult | null {
  if (
    !isTakuzuPlayRecord(record) ||
    !isTakuzuProblemIdentity(record.payload.problemIdentity)
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
