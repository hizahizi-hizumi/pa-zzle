import { parseDifficultyLevel } from "@/games/difficulty";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import {
  createHakoiriMusumeResult,
  type HakoiriMusumeResult,
} from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import {
  type HakoiriMusumeProblemIdentity,
  type HakoiriMusumeRecordedProblemIdentity,
  isCurrentHakoiriMusumeProblemIdentity,
  isHakoiriMusumeRecordedProblemIdentity,
} from "@/games/hakoiri-musume/problem/problem";
import {
  findHakoiriMusumePoolDifficulty,
  findHakoiriMusumePoolEntryByBoard,
} from "@/games/hakoiri-musume/problem/problem-pool";
import {
  calculateHakoiriMusumeMoveDelta,
  calculateHakoiriMusumePlayScore,
  calculateHakoiriMusumeTimeDeltaMs,
} from "@/games/hakoiri-musume/score";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const HAKOIRI_MUSUME_GAME_ID = "hakoiri-musume";
const HAKOIRI_MUSUME_PLAY_RECORD_PAYLOAD_VERSION = 1;

type HakoiriMusumePlayPerformance = {
  elapsedMs: number;
  /** 指した手の数。待ったで取り消した手と、盤面を戻す前の手も含む。 */
  moveCount: number;
  /** 完成した盤面までの手の数。これを残す前の記録には無い。 */
  completionMoveCount?: number;
  undoCount: number;
  restartCount: number;
  optimalMoveCount: number;
  preparationLength: number;
};

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `performance`: そのプレイで起きた事実と、問題集から外れても評価できるよう残す問題の作業の量（最短手数と準備の長さ）。
 *   評価点・評価段階・基準との差は保存せず、現在の評価規則で導出する。
 */
type HakoiriMusumePlayRecordPayload = {
  difficulty: HakoiriMusumeDifficulty;
  problemIdentity: HakoiriMusumeRecordedProblemIdentity;
  performance: HakoiriMusumePlayPerformance;
};

type HakoiriMusumePlayRecord = PlayRecord & {
  gameId: typeof HAKOIRI_MUSUME_GAME_ID;
  payloadVersion: typeof HAKOIRI_MUSUME_PLAY_RECORD_PAYLOAD_VERSION;
  payload: HakoiriMusumePlayRecordPayload;
};

type CreateHakoiriMusumePlayRecordInput = {
  difficulty: HakoiriMusumeDifficulty;
  problemIdentity: HakoiriMusumeProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: Omit<HakoiriMusumePlayPerformance, "completionMoveCount"> & {
    completionMoveCount: number | null;
  };
};

/**
 * 記録として受け取る手数の上限（最短手数に対する倍率）と、経過時間の上限。これを超える記録は、書き換えられたか壊れたものとして
 * 読まない。どちらも人が1問を遊び切るのにかかる量を大きく超える。
 */
const RECORDED_MOVE_COUNT_LIMIT_RATIO = 50;
const RECORDED_ELAPSED_MS_LIMIT = 24 * 60 * 60 * 1000;

/**
 * 待ったは指した1手を取り消すので、指した手の数を超えない。クリアには最短手数以上の手が要り、完成した盤面までの手は
 * 指した手の数を超えない。
 */
function isHakoiriMusumePerformance(
  value: unknown,
): value is HakoiriMusumePlayPerformance {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    value.elapsedMs <= RECORDED_ELAPSED_MS_LIMIT &&
    isPositiveInteger(value.moveCount) &&
    (value.completionMoveCount === undefined ||
      (isPositiveInteger(value.completionMoveCount) &&
        value.completionMoveCount <= value.moveCount &&
        isPositiveInteger(value.optimalMoveCount) &&
        value.optimalMoveCount <= value.completionMoveCount)) &&
    isNonNegativeInteger(value.undoCount) &&
    value.undoCount <= value.moveCount &&
    isNonNegativeInteger(value.restartCount) &&
    isPositiveInteger(value.optimalMoveCount) &&
    value.optimalMoveCount <= value.moveCount &&
    value.moveCount <=
      value.optimalMoveCount * RECORDED_MOVE_COUNT_LIMIT_RATIO &&
    isNonNegativeInteger(value.preparationLength) &&
    value.preparationLength < value.optimalMoveCount
  );
}

export function isHakoiriMusumePlayRecord(
  record: PlayRecord,
): record is HakoiriMusumePlayRecord {
  if (
    record.gameId !== HAKOIRI_MUSUME_GAME_ID ||
    record.payloadVersion !== HAKOIRI_MUSUME_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  return (
    typeof difficulty === "string" &&
    parseDifficultyLevel(difficulty) !== undefined &&
    isHakoiriMusumeRecordedProblemIdentity(problemIdentity) &&
    isRecordedAtPoolDifficulty(
      difficulty as HakoiriMusumeDifficulty,
      problemIdentity,
    ) &&
    isHakoiriMusumePerformance(performance)
  );
}

/** 今の問題集にある盤面の記録は、その盤面を収めた難易度で遊んだものに限る。問題集に無い盤面は難易度を確かめられない。 */
function isRecordedAtPoolDifficulty(
  difficulty: HakoiriMusumeDifficulty,
  problemIdentity: HakoiriMusumeRecordedProblemIdentity,
): boolean {
  if (!isCurrentHakoiriMusumeProblemIdentity(problemIdentity)) {
    return true;
  }
  const pooledDifficulty = findHakoiriMusumePoolDifficulty(
    problemIdentity.seed,
  );
  return pooledDifficulty === null || pooledDifficulty === difficulty;
}

export function createHakoiriMusumePlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateHakoiriMusumePlayRecordInput): HakoiriMusumePlayRecord {
  return {
    id: createPlayRecordId([
      HAKOIRI_MUSUME_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: HAKOIRI_MUSUME_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: HAKOIRI_MUSUME_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      performance: {
        elapsedMs: result.elapsedMs,
        moveCount: result.moveCount,
        ...(result.completionMoveCount === null
          ? {}
          : { completionMoveCount: result.completionMoveCount }),
        undoCount: result.undoCount,
        restartCount: result.restartCount,
        optimalMoveCount: result.optimalMoveCount,
        preparationLength: result.preparationLength,
      },
    },
  };
}

/** 記録から作り直した、結果画面に出す内容。 */
export type HakoiriMusumeRecordedResult = {
  difficulty: HakoiriMusumeDifficulty;
  problemIdentity: HakoiriMusumeProblemIdentity;
  result: HakoiriMusumeResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 * 今の問題集にある盤面なら、最短手数と準備の長さは問題集の値で評価する（記録の値と食い違えば問題集を正とする）。
 */
export function restoreHakoiriMusumeRecordedResult(
  record: PlayRecord,
): HakoiriMusumeRecordedResult | null {
  if (
    !isHakoiriMusumePlayRecord(record) ||
    !isCurrentHakoiriMusumeProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  const {
    optimalMoveCount,
    preparationLength,
    completionMoveCount = null,
    ...sessionResult
  } = performance;
  const pooled = findHakoiriMusumePoolEntryByBoard(problemIdentity.seed);
  return {
    difficulty,
    problemIdentity,
    result: createHakoiriMusumeResult(
      { ...sessionResult, completionMoveCount },
      pooled
        ? { optimalMoveCount: pooled[1], preparationLength: pooled[2] }
        : { optimalMoveCount, preparationLength },
    ),
  };
}

function getHakoiriMusumePlayRecordScore(record: PlayRecord): number | null {
  if (!isHakoiriMusumePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, moveCount, optimalMoveCount, preparationLength } =
    record.payload.performance;
  return calculateHakoiriMusumePlayScore({
    elapsedMs,
    moveCount,
    optimalMoveCount,
    preparationLength,
  }).total;
}

function getHakoiriMusumePlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isHakoiriMusumePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, optimalMoveCount, preparationLength } =
    record.payload.performance;
  return calculateHakoiriMusumeTimeDeltaMs({
    elapsedMs,
    optimalMoveCount,
    preparationLength,
  });
}

function getHakoiriMusumePlayRecordMoveDelta(
  record: PlayRecord,
): number | null {
  if (!isHakoiriMusumePlayRecord(record)) {
    return null;
  }

  const { moveCount, optimalMoveCount } = record.payload.performance;
  return calculateHakoiriMusumeMoveDelta({ moveCount, optimalMoveCount });
}

export type HakoiriMusumePlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "move-delta";

export const hakoiriMusumePlayRecordDefinition = {
  gameId: HAKOIRI_MUSUME_GAME_ID,
  isRecord: isHakoiriMusumePlayRecord,
  getComparisonKey(record) {
    return isHakoiriMusumePlayRecord(record) ? record.payload.difficulty : null;
  },
  getClearPerformance(record) {
    if (!isHakoiriMusumePlayRecord(record)) {
      return null;
    }
    const { elapsedMs, moveCount, optimalMoveCount } =
      record.payload.performance;
    return {
      elapsedMs,
      moves: { completionMoveCount: moveCount, optimalMoveCount },
    };
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getHakoiriMusumePlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getHakoiriMusumePlayRecordTimeDelta,
    },
    {
      id: "move-delta",
      direction: "lower",
      getValue: getHakoiriMusumePlayRecordMoveDelta,
    },
  ],
} satisfies PlayRecordDefinition<HakoiriMusumePlayRecordMetricId>;

export const _private = {
  getHakoiriMusumePlayRecordScore,
  getHakoiriMusumePlayRecordTimeDelta,
  getHakoiriMusumePlayRecordMoveDelta,
};
