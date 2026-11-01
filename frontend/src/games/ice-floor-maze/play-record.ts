import { parseDifficultyLevel } from "@/games/difficulty";
import {
  type IceFloorMazeDifficulty,
  isIceFloorMazeBoardShapeOfDifficulty,
} from "@/games/ice-floor-maze/difficulty";
import {
  createIceFloorMazeResult,
  type IceFloorMazeResult,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  type IceFloorMazeProblemIdentity,
  type IceFloorMazeRecordedProblemIdentity,
  isIceFloorMazeProblemIdentity,
  isIceFloorMazeRecordedProblemIdentity,
} from "@/games/ice-floor-maze/problem/problem";
import {
  calculateIceFloorMazeMoveDelta,
  calculateIceFloorMazePlayScore,
  calculateIceFloorMazeTimeDeltaMs,
  getIceFloorMazeSpeedReference,
} from "@/games/ice-floor-maze/score";
import {
  isNonNegativeFiniteNumber,
  isNonNegativeInteger,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";
import { createPlayRecordId, type PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

const ICE_FLOOR_MAZE_GAME_ID = "ice-floor-maze";
const ICE_FLOOR_MAZE_PLAY_RECORD_PAYLOAD_VERSION = 1;

type IceFloorMazePlayPerformance = {
  elapsedMs: number;
  /** 成立した滑りの総数。待ったで取り消した手と、盤面を戻す前の手も含む。 */
  moveCount: number;
  undoCount: number;
  restartCount: number;
  optimalMoveCount: number;
};

/**
 * - `problemIdentity`: 再プレイで問題集から同じ問題を引くのに使う。生成器の版が今と違う記録も読み込み、再プレイだけできないものとして扱う。
 *   速さの基準時間に使う描くマスと要素（もろい岩・薄い氷）の数も、ここから数え直す（版 `"1"` は幅 × 高さのマスと要素0）。
 * - `performance`: そのプレイで起きた事実と、問題集から外れても評価できるよう残す最短手数。
 *   評価点・評価段階・基準との差は保存せず、現在の評価規則で導出する。
 */
type IceFloorMazePlayRecordPayload = {
  difficulty: IceFloorMazeDifficulty;
  problemIdentity: IceFloorMazeRecordedProblemIdentity;
  performance: IceFloorMazePlayPerformance;
};

type IceFloorMazePlayRecord = PlayRecord & {
  gameId: typeof ICE_FLOOR_MAZE_GAME_ID;
  payloadVersion: typeof ICE_FLOOR_MAZE_PLAY_RECORD_PAYLOAD_VERSION;
  payload: IceFloorMazePlayRecordPayload;
};

type CreateIceFloorMazePlayRecordInput = {
  difficulty: IceFloorMazeDifficulty;
  problemIdentity: IceFloorMazeProblemIdentity;
  startedAt: number;
  completedAt: number;
  result: IceFloorMazePlayPerformance;
};

/** 待ったは止まった1手を取り消すので、総手数を超えない。クリアには最短手数以上の滑りが要る。 */
function isIceFloorMazePerformance(
  value: unknown,
): value is IceFloorMazePlayPerformance {
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

function isRecordedIdentityOfDifficulty(
  identity: IceFloorMazeRecordedProblemIdentity,
  difficulty: IceFloorMazeDifficulty,
): boolean {
  return (
    !isIceFloorMazeProblemIdentity(identity) ||
    isIceFloorMazeBoardShapeOfDifficulty(identity.conditions, difficulty)
  );
}

export function isIceFloorMazePlayRecord(
  record: PlayRecord,
): record is IceFloorMazePlayRecord {
  if (
    record.gameId !== ICE_FLOOR_MAZE_GAME_ID ||
    record.payloadVersion !== ICE_FLOOR_MAZE_PLAY_RECORD_PAYLOAD_VERSION ||
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
    isIceFloorMazeRecordedProblemIdentity(problemIdentity) &&
    isRecordedIdentityOfDifficulty(problemIdentity, parsedDifficulty) &&
    isIceFloorMazePerformance(performance)
  );
}

export function createIceFloorMazePlayRecord({
  difficulty,
  problemIdentity,
  startedAt,
  completedAt,
  result,
}: CreateIceFloorMazePlayRecordInput): IceFloorMazePlayRecord {
  return {
    id: createPlayRecordId([
      ICE_FLOOR_MAZE_GAME_ID,
      startedAt,
      completedAt,
      problemIdentity.seed,
    ]),
    gameId: ICE_FLOOR_MAZE_GAME_ID,
    startedAt,
    completedAt,
    payloadVersion: ICE_FLOOR_MAZE_PLAY_RECORD_PAYLOAD_VERSION,
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
export type IceFloorMazeRecordedResult = {
  difficulty: IceFloorMazeDifficulty;
  problemIdentity: IceFloorMazeProblemIdentity;
  result: IceFloorMazeResult;
};

/**
 * 記録から結果画面に出す内容を作り直す。
 * 今の版の記録で、今の生成器の問題のときだけ作れる。それ以外は `null` を返す。
 */
export function restoreIceFloorMazeRecordedResult(
  record: PlayRecord,
): IceFloorMazeRecordedResult | null {
  if (
    !isIceFloorMazePlayRecord(record) ||
    !isIceFloorMazeProblemIdentity(record.payload.problemIdentity)
  ) {
    return null;
  }

  const { difficulty, problemIdentity, performance } = record.payload;
  const { optimalMoveCount, ...sessionResult } = performance;
  return {
    difficulty,
    problemIdentity,
    result: createIceFloorMazeResult(
      sessionResult,
      problemIdentity,
      optimalMoveCount,
    ),
  };
}

function getIceFloorMazePlayRecordScore(record: PlayRecord): number | null {
  if (!isIceFloorMazePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, moveCount, optimalMoveCount } = record.payload.performance;
  return calculateIceFloorMazePlayScore({
    elapsedMs,
    moveCount,
    speedReference: getIceFloorMazeSpeedReference(
      record.payload.problemIdentity,
    ),
    optimalMoveCount,
  }).total;
}

function getIceFloorMazePlayRecordTimeDelta(record: PlayRecord): number | null {
  if (!isIceFloorMazePlayRecord(record)) {
    return null;
  }

  const { elapsedMs, optimalMoveCount } = record.payload.performance;
  return calculateIceFloorMazeTimeDeltaMs({
    elapsedMs,
    speedReference: getIceFloorMazeSpeedReference(
      record.payload.problemIdentity,
    ),
    optimalMoveCount,
  });
}

function getIceFloorMazePlayRecordMoveDelta(record: PlayRecord): number | null {
  if (!isIceFloorMazePlayRecord(record)) {
    return null;
  }

  const { moveCount, optimalMoveCount } = record.payload.performance;
  return calculateIceFloorMazeMoveDelta({ moveCount, optimalMoveCount });
}

export type IceFloorMazePlayRecordMetricId =
  | "play-score"
  | "time-delta-ms"
  | "move-delta";

export const iceFloorMazePlayRecordDefinition = {
  gameId: ICE_FLOOR_MAZE_GAME_ID,
  isRecord: isIceFloorMazePlayRecord,
  getComparisonKey(record) {
    return isIceFloorMazePlayRecord(record) ? record.payload.difficulty : null;
  },
  personalBestMetrics: [
    {
      id: "play-score",
      direction: "higher",
      getValue: getIceFloorMazePlayRecordScore,
    },
    {
      id: "time-delta-ms",
      direction: "lower",
      getValue: getIceFloorMazePlayRecordTimeDelta,
    },
    {
      id: "move-delta",
      direction: "lower",
      getValue: getIceFloorMazePlayRecordMoveDelta,
    },
  ],
} satisfies PlayRecordDefinition<IceFloorMazePlayRecordMetricId>;

export const _private = {
  getIceFloorMazePlayRecordScore,
  getIceFloorMazePlayRecordTimeDelta,
  getIceFloorMazePlayRecordMoveDelta,
};
