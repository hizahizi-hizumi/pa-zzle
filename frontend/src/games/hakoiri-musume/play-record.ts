import { parseDifficultyLevel } from "@/games/difficulty";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import {
  createHakoiriMusumeResult,
  type HakoiriMusumeResult,
} from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import {
  type HakoiriMusumeProblemIdentity,
  type HakoiriMusumeRecordedProblemIdentity,
  isHakoiriMusumeProblemIdentity,
  isHakoiriMusumeRecordedProblemIdentity,
} from "@/games/hakoiri-musume/problem/problem";
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
  undoCount: number;
  restartCount: number;
  optimalMoveCount: number;
};

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 * - `performance`: そのプレイで起きた事実と、問題集から外れても評価できるよう残す最短手数。
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
  result: HakoiriMusumePlayPerformance;
};

/** 待ったは指した1手を取り消すので、指した手の数を超えない。クリアには最短手数以上の手が要る。 */
function isHakoiriMusumePerformance(
  value: unknown,
): value is HakoiriMusumePlayPerformance {
  return (
    isRecordObject(value) &&
    isNonNegativeFiniteNumber(value.elapsedMs) &&
    isPositiveInteger(value.moveCount) &&
    isNonNegativeInteger(value.undoCount) &&
    value.undoCount <= value.moveCount &&
    isNonNegativeInteger(value.restartCount) &&
    isPositiveInteger(value.optimalMoveCount) &&
    value.optimalMoveCount <= value.moveCount
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
    isHakoiriMusumePerformance(performance)
  );
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
        undoCount: result.undoCount,
        restartCount: result.restartCount,
        optimalMoveCount: result.optimalMoveCount,
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
 */
export function restoreHakoiriMusumeRecordedResult(
  record: PlayRecord,
): HakoiriMusumeRecordedResult | null {
  if (
    !isHakoiriMusumePlayRecord(record) ||
    !isHakoiriMusumeProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  const { optimalMoveCount, ...sessionResult } = performance;
  return {
    difficulty,
    problemIdentity,
    result: createHakoiriMusumeResult(sessionResult, optimalMoveCount),
  };
}

function getHakoiriMusumePlayRecordScore(record: PlayRecord): number | null {
  if (!isHakoiriMusumePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, moveCount, optimalMoveCount } = record.payload.performance;
  return calculateHakoiriMusumePlayScore({
    elapsedMs,
    moveCount,
    optimalMoveCount,
  }).total;
}

function getHakoiriMusumePlayRecordTimeDelta(
  record: PlayRecord,
): number | null {
  if (!isHakoiriMusumePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, optimalMoveCount } = record.payload.performance;
  return calculateHakoiriMusumeTimeDeltaMs({ elapsedMs, optimalMoveCount });
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
