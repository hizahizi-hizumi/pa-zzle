import { parseDifficultyLevel } from "@/games/difficulty";
import {
  isSlidePuzzleProblemIdentityOfDifficulty,
  type SlidePuzzleDifficulty,
} from "@/games/slide-puzzle/difficulty";
import {
  createSlidePuzzleResult,
  type SlidePuzzleResult,
} from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import {
  isSlidePuzzleProblemIdentity,
  isSlidePuzzleRecordedProblemIdentity,
  type SlidePuzzleProblemIdentity,
  type SlidePuzzleRecordedProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import {
  calculateSlidePuzzleMoveDelta,
  calculateSlidePuzzlePlayScore,
  calculateSlidePuzzleTimeDeltaMs,
} from "@/games/slide-puzzle/score";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const SLIDE_PUZZLE_GAME_ID = "slide-puzzle";
const SLIDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION = 1;

type SlidePuzzlePlayPerformance = {
  elapsedMs: number;
  /** 動いたタイルの総枚数。盤面を戻す前の手も含む。 */
  moveCount: number;
  /** 最後に盤面を戻してから完成までに動いたタイルの枚数。 */
  completionMoveCount: number;
  /** 入力としてのスライド操作の回数。評価には使わない。 */
  slideCount: number;
  restartCount: number;
  optimalMoveCount: number;
};

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `performance`: そのプレイで起きた事実。評価点・評価段階・基準との差は保存せず、現在の評価規則で導出する。
 */
type SlidePuzzlePlayRecordPayload = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleRecordedProblemIdentity;
  performance: SlidePuzzlePlayPerformance;
};

type SlidePuzzlePlayRecord = PlayRecord & {
  gameId: typeof SLIDE_PUZZLE_GAME_ID;
  payloadVersion: typeof SLIDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: SlidePuzzlePlayRecordPayload;
};

type CreateSlidePuzzlePlayRecordInput = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: SlidePuzzlePlayPerformance;
};

function isSlidePuzzlePerformance(
  value: unknown,
): value is SlidePuzzlePlayPerformance {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isPositiveInteger(value.moveCount) &&
    isPositiveInteger(value.completionMoveCount) &&
    value.completionMoveCount <= value.moveCount &&
    isPositiveInteger(value.slideCount) &&
    value.slideCount <= value.moveCount &&
    isNonNegativeInteger(value.restartCount) &&
    isPositiveInteger(value.optimalMoveCount) &&
    value.optimalMoveCount <= value.completionMoveCount
  );
}

function isRecordedIdentityOfDifficulty(
  identity: SlidePuzzleRecordedProblemIdentity,
  difficulty: SlidePuzzleDifficulty,
): boolean {
  return (
    !isSlidePuzzleProblemIdentity(identity) ||
    isSlidePuzzleProblemIdentityOfDifficulty(identity, difficulty)
  );
}

export function isSlidePuzzlePlayRecord(
  record: PlayRecord,
): record is SlidePuzzlePlayRecord {
  if (
    record.gameId !== SLIDE_PUZZLE_GAME_ID ||
    record.payloadVersion !== SLIDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION ||
    !isRecordObject(record.payload)
  ) {
    return false;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  const parsedDifficulty =
    typeof difficulty === "string"
      ? parseDifficultyLevel(difficulty)
      : undefined;
  return (
    parsedDifficulty !== undefined &&
    isSlidePuzzleRecordedProblemIdentity(problemIdentity) &&
    isRecordedIdentityOfDifficulty(problemIdentity, parsedDifficulty) &&
    isSlidePuzzlePerformance(performance)
  );
}

export function createSlidePuzzlePlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateSlidePuzzlePlayRecordInput): SlidePuzzlePlayRecord {
  return {
    id: createPlayRecordId([
      SLIDE_PUZZLE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: SLIDE_PUZZLE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: SLIDE_PUZZLE_PLAY_RECORD_PAYLOAD_VERSION,
    payload: {
      difficulty,
      problemIdentity: {
        ...problemIdentity,
        conditions: { ...problemIdentity.conditions },
      },
      performance: {
        elapsedMs: result.elapsedMs,
        moveCount: result.moveCount,
        completionMoveCount: result.completionMoveCount,
        slideCount: result.slideCount,
        restartCount: result.restartCount,
        optimalMoveCount: result.optimalMoveCount,
      },
    },
  };
}

/** 記録から作り直した、結果画面に出す内容。 */
export type SlidePuzzleRecordedResult = {
  difficulty: SlidePuzzleDifficulty;
  problemIdentity: SlidePuzzleProblemIdentity;
  result: SlidePuzzleResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreSlidePuzzleRecordedResult(
  record: PlayRecord,
): SlidePuzzleRecordedResult | null {
  if (
    !isSlidePuzzlePlayRecord(record) ||
    !isSlidePuzzleProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  const { optimalMoveCount, ...sessionResult } = performance;
  return {
    difficulty,
    problemIdentity,
    result: createSlidePuzzleResult(
      sessionResult,
      problemIdentity.conditions.size,
      optimalMoveCount,
    ),
  };
}

function getSlidePuzzlePlayRecordScore(record: PlayRecord): number | null {
  if (!isSlidePuzzlePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, moveCount, optimalMoveCount } = record.payload.performance;
  return calculateSlidePuzzlePlayScore({
    elapsedMs,
    moveCount,
    boardSize: record.payload.problemIdentity.conditions.size,
    optimalMoveCount,
  }).total;
}

function getSlidePuzzlePlayRecordTimeDelta(record: PlayRecord): number | null {
  if (!isSlidePuzzlePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, optimalMoveCount } = record.payload.performance;
  return calculateSlidePuzzleTimeDeltaMs({
    elapsedMs,
    boardSize: record.payload.problemIdentity.conditions.size,
    optimalMoveCount,
  });
}

function getSlidePuzzlePlayRecordMoveDelta(record: PlayRecord): number | null {
  if (!isSlidePuzzlePlayRecord(record)) {
    return null;
  }

  const { moveCount, optimalMoveCount } = record.payload.performance;
  return calculateSlidePuzzleMoveDelta({ moveCount, optimalMoveCount });
}

export type SlidePuzzlePlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "move-delta";

export const slidePuzzlePlayRecordDefinition = {
  gameId: SLIDE_PUZZLE_GAME_ID,
  isRecord: isSlidePuzzlePlayRecord,
  getComparisonKey(record) {
    return isSlidePuzzlePlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getSlidePuzzlePlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getSlidePuzzlePlayRecordTimeDelta,
    },
    {
      id: "move-delta",
      direction: "lower",
      getValue: getSlidePuzzlePlayRecordMoveDelta,
    },
  ],
} satisfies PlayRecordDefinition<SlidePuzzlePlayRecordMetricId>;

export const _private = {
  getSlidePuzzlePlayRecordScore,
  getSlidePuzzlePlayRecordTimeDelta,
  getSlidePuzzlePlayRecordMoveDelta,
};
