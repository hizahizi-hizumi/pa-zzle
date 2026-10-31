import {
  assertIceFloorMazeBoard,
  type IceFloorMazeBoard,
  type IceFloorMazeCell,
  isIceFloorMazeIceCell,
} from "@/games/ice-floor-maze/puzzle/board";
import { exploreIceFloorMazeStops } from "@/games/ice-floor-maze/puzzle/stop-graph";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { isPositiveInteger, isRecordObject } from "@/lib/type-guards";

/** 1問を遊ぶためのデータ。駒は `start` から動き出し、`goal` で止まればクリア。 */
export type IceFloorMazeProblem = {
  board: IceFloorMazeBoard;
  start: number;
  goal: number;
};

/** 盤面の形。`width` は列数、`height` は行数。 */
export type IceFloorMazeBoardShape = {
  width: number;
  height: number;
};

/**
 * 生成器が扱う盤面の形の範囲。正方形と縦長だけを扱い、横長は出さない。
 * 最も広い形は、スマートフォンで1マスを読める大きさに収まる 12×14。
 */
const minimumBoardSide = 3;
const maximumBoardShape = {
  width: 12,
  height: 14,
} as const satisfies IceFloorMazeBoardShape;

/** 盤面の中身（岩・開始位置・ゴール）の符号化が変わり、同じ identity から別の問題ができるようになったら上げる。 */
export const ICE_FLOOR_MAZE_GENERATOR_VERSION = "1";

/**
 * 同じ問題を再現するための情報。問題集に盤面そのものを持つので、`seed` は乱数の種ではなく、
 * 無関係な岩を除いた盤面と開始位置・ゴールの符号化（`createIceFloorMazeProblemIdentity`）。
 */
export type IceFloorMazeProblemIdentity = {
  generatorVersion: typeof ICE_FLOOR_MAZE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: IceFloorMazeBoardShape;
};

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も、盤面の形が読めれば読み込む。 */
export type IceFloorMazeRecordedProblemIdentity =
  RecordedProblemIdentity<IceFloorMazeBoardShape>;

/** 問題と、それを再現するための情報。 */
export type IceFloorMazeIdentifiedProblem = {
  problem: IceFloorMazeProblem;
  identity: IceFloorMazeProblemIdentity;
};

export function isIceFloorMazeBoardShape(
  value: unknown,
): value is IceFloorMazeBoardShape {
  if (!isRecordObject(value)) {
    return false;
  }

  const { width, height } = value;
  return (
    isPositiveInteger(width) &&
    isPositiveInteger(height) &&
    minimumBoardSide <= width &&
    width <= height &&
    width <= maximumBoardShape.width &&
    height <= maximumBoardShape.height
  );
}

export function assertIceFloorMazeProblem(problem: IceFloorMazeProblem): void {
  const { board, start, goal } = problem;
  assertIceFloorMazeBoard(board);

  const { width, height } = board;
  if (!isIceFloorMazeBoardShape({ width, height })) {
    throw new RangeError(
      `Unsupported ice floor maze board shape: ${width}x${height}`,
    );
  }

  if (
    !isIceFloorMazeIceCell(board, start) ||
    !isIceFloorMazeIceCell(board, goal)
  ) {
    throw new RangeError("Ice floor maze start and goal must be on ice");
  }

  if (start === goal) {
    throw new RangeError("Ice floor maze goal must differ from the start");
  }

  if (!exploreIceFloorMazeStops(board, start).moveCounts.has(goal)) {
    throw new Error("Ice floor maze goal must be reachable from the start");
  }
}

const cellsPerHexDigit = 4;
const seedPattern = /^([0-9a-f]+)-(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$/;

/** 岩を1、氷を0とした行優先のビット列を、先頭のマスを上位ビットにして4マスずつ16進の1桁にする。 */
function encodeRocks(cells: readonly IceFloorMazeCell[]): string {
  const digitCount = Math.ceil(cells.length / cellsPerHexDigit);
  return Array.from({ length: digitCount }, (_, digitIndex) => {
    let digit = 0;
    for (let bit = 0; bit < cellsPerHexDigit; bit += 1) {
      digit <<= 1;
      if (cells[digitIndex * cellsPerHexDigit + bit] === "rock") {
        digit |= 1;
      }
    }
    return digit.toString(16);
  }).join("");
}

function decodeRocks(
  encoded: string,
  cellCount: number,
): IceFloorMazeCell[] | null {
  if (encoded.length !== Math.ceil(cellCount / cellsPerHexDigit)) {
    return null;
  }

  const cells = Array.from(encoded, (hexDigit) => {
    const digit = Number.parseInt(hexDigit, 16);
    return Array.from({ length: cellsPerHexDigit }, (_, bit) =>
      (digit >> (cellsPerHexDigit - 1 - bit)) & 1 ? "rock" : "ice",
    );
  }).flat();
  const paddingIsIce = cells.slice(cellCount).every((cell) => cell === "ice");
  return paddingIsIce ? cells.slice(0, cellCount) : null;
}

/**
 * 盤面の形と `seed` から問題を復号する。形・符号化・開始位置とゴールの置き場所が正しくなければ `null`。
 * ゴールへ到達できるかは確かめない。
 */
function decodeIceFloorMazeProblem(
  seed: string,
  shape: IceFloorMazeBoardShape,
): IceFloorMazeProblem | null {
  const matched = seedPattern.exec(seed);
  if (!matched || !isIceFloorMazeBoardShape(shape)) {
    return null;
  }

  const [, encodedRocks = "", encodedStart, encodedGoal] = matched;
  const cells = decodeRocks(encodedRocks, shape.width * shape.height);
  if (!cells) {
    return null;
  }

  const board = { width: shape.width, height: shape.height, cells };
  const start = Number(encodedStart);
  const goal = Number(encodedGoal);
  const placesPieceAndGoalOnIce =
    start !== goal &&
    isIceFloorMazeIceCell(board, start) &&
    isIceFloorMazeIceCell(board, goal);
  return placesPieceAndGoalOnIce ? { board, start, goal } : null;
}

/**
 * 問題から identity を作る。`seed` は岩の配置の16進符号・開始位置・ゴールを `-` でつなぐ。
 * 例: 8×8 で岩が左上の1マスだけ、開始位置 9、ゴール 63 なら `8000000000000000-9-63`。
 */
export function createIceFloorMazeProblemIdentity(
  problem: IceFloorMazeProblem,
): IceFloorMazeProblemIdentity {
  const { board, start, goal } = problem;
  return {
    generatorVersion: ICE_FLOOR_MAZE_GENERATOR_VERSION,
    seed: `${encodeRocks(board.cells)}-${start}-${goal}`,
    conditions: { width: board.width, height: board.height },
  };
}

/** identity の `seed` から問題を復号する。生成器は走らせない。 */
export function restoreIceFloorMazeProblem(
  identity: IceFloorMazeProblemIdentity,
): IceFloorMazeIdentifiedProblem {
  if (identity.generatorVersion !== ICE_FLOOR_MAZE_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported ice floor maze generator version: ${identity.generatorVersion}`,
    );
  }

  const problem = decodeIceFloorMazeProblem(identity.seed, identity.conditions);
  if (!problem) {
    throw new RangeError(
      `Invalid ice floor maze problem seed: ${identity.seed}`,
    );
  }
  assertIceFloorMazeProblem(problem);
  return { problem, identity };
}

/** 記録・診断など外部から読み戻した値が、現在の生成器で復元できる識別情報かを確かめる。 */
export function isIceFloorMazeProblemIdentity(
  value: unknown,
): value is IceFloorMazeProblemIdentity {
  if (!isRecordObject(value) || !isIceFloorMazeBoardShape(value.conditions)) {
    return false;
  }

  return (
    value.generatorVersion === ICE_FLOOR_MAZE_GENERATOR_VERSION &&
    typeof value.seed === "string" &&
    decodeIceFloorMazeProblem(value.seed, value.conditions) !== null
  );
}

/** 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。 */
export function isIceFloorMazeRecordedProblemIdentity(
  value: unknown,
): value is IceFloorMazeRecordedProblemIdentity {
  return (
    isRecordedProblemIdentity(value, {
      generatorVersion: ICE_FLOOR_MAZE_GENERATOR_VERSION,
      isProblemIdentity: isIceFloorMazeProblemIdentity,
    }) &&
    isPositiveInteger(value.conditions.width) &&
    isPositiveInteger(value.conditions.height)
  );
}

export const _private = {
  decodeIceFloorMazeProblem,
};
