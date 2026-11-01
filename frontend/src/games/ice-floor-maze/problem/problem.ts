import {
  assertIceFloorMazeBoard,
  countIceFloorMazeDrawnCells,
  type IceFloorMazeBoard,
  type IceFloorMazeCell,
  iceFloorMazeCells,
  isIceFloorMazeIceCell,
} from "@/games/ice-floor-maze/puzzle/board";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { isPositiveInteger, isRecordObject } from "@/lib/type-guards";

/**
 * 1問を遊ぶためのデータ。駒は `start` から動き出し、`goal` で止まればクリア。
 * 盤面は盤面の外を切り落とした外接の長方形で、開始位置とゴールは氷のマス（薄い氷ではない）。
 */
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

/** 盤面の中身（マスの種類・開始位置・ゴール）の符号化が変わり、同じ identity から別の問題ができるようになったら上げる。 */
export const ICE_FLOOR_MAZE_GENERATOR_VERSION = "2";

/**
 * 同じ問題を再現するための情報。問題集に盤面そのものを持つので、`seed` は乱数の種ではなく、
 * 盤面と開始位置・ゴールの符号化（`createIceFloorMazeProblemIdentity`）。
 */
export type IceFloorMazeProblemIdentity = {
  generatorVersion: typeof ICE_FLOOR_MAZE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: IceFloorMazeBoardShape;
};

/**
 * 記録に残した問題の識別情報。生成器の版が今と違う記録も、盤面の形が読めれば読み込む。
 * 初期版（版 `"1"`）の記録は盤面の形と最短手数で評価し、結果画面の作り直しと再プレイはしない。
 */
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

  if (!isCroppedToDrawnCells(board)) {
    throw new RangeError(
      "Ice floor maze board must be cropped to the drawn cells",
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

  const graph = exploreIceFloorMazeStates(
    board,
    createIceFloorMazeInitialState(board, start),
    { goal },
  );
  if (!graph) {
    throw new RangeError("Ice floor maze problem has too many states");
  }
  if (!graph.states.some(({ position }) => position === goal)) {
    throw new Error("Ice floor maze goal must be reachable from the start");
  }
}

/** 外周の4辺のどれにも、盤面として描くマスがある。 */
function isCroppedToDrawnCells(board: IceFloorMazeBoard): boolean {
  const { width, height, cells } = board;
  function hasDrawnCell(cellIndices: readonly number[]): boolean {
    return cellIndices.some((cellIndex) => cells[cellIndex] !== "outside");
  }
  const columns = Array.from({ length: width }, (_, x) => x);
  const rows = Array.from({ length: height }, (_, y) => y);
  return (
    hasDrawnCell(columns) &&
    hasDrawnCell(columns.map((x) => (height - 1) * width + x)) &&
    hasDrawnCell(rows.map((y) => y * width)) &&
    hasDrawnCell(rows.map((y) => y * width + width - 1))
  );
}

/** マスの種類の番号は `iceFloorMazeCells` の順。2マスを `5 × 先のマス + 後のマス` として base32 の1桁にする。 */
const cellKindCount = iceFloorMazeCells.length;
const cellsPerDigit = 2;
const digitRadix = 32;
const seedPattern = /^([0-9a-o]+)-(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$/;

/** 行優先のマスを2マスずつ base32 の1桁にする。マス数が奇数なら、最後の桁の後のマスを氷で詰める。 */
function encodeCells(cells: readonly IceFloorMazeCell[]): string {
  const digitCount = Math.ceil(cells.length / cellsPerDigit);
  return Array.from({ length: digitCount }, (_, digitIndex) => {
    const [first, second = "ice"] = cells.slice(
      digitIndex * cellsPerDigit,
      (digitIndex + 1) * cellsPerDigit,
    );
    const digit =
      iceFloorMazeCells.indexOf(first!) * cellKindCount +
      iceFloorMazeCells.indexOf(second);
    return digit.toString(digitRadix);
  }).join("");
}

function decodeCells(
  encoded: string,
  cellCount: number,
): IceFloorMazeCell[] | null {
  if (encoded.length !== Math.ceil(cellCount / cellsPerDigit)) {
    return null;
  }

  const cells = Array.from(encoded, (character) => {
    const digit = Number.parseInt(character, digitRadix);
    return [
      iceFloorMazeCells[Math.floor(digit / cellKindCount)]!,
      iceFloorMazeCells[digit % cellKindCount]!,
    ];
  }).flat();
  const paddingIsIce = cells.slice(cellCount).every((cell) => cell === "ice");
  return paddingIsIce ? cells.slice(0, cellCount) : null;
}

/**
 * 盤面の形と `seed` から問題を復号する。形・符号化・開始位置とゴールの置き場所が正しくなければ `null`。
 * 盤面の切り落としとゴールへ到達できるかは確かめない。
 */
function decodeIceFloorMazeProblem(
  seed: string,
  shape: IceFloorMazeBoardShape,
): IceFloorMazeProblem | null {
  const matched = seedPattern.exec(seed);
  if (!matched || !isIceFloorMazeBoardShape(shape)) {
    return null;
  }

  const [, encodedCells = "", encodedStart, encodedGoal] = matched;
  const cells = decodeCells(encodedCells, shape.width * shape.height);
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
 * 問題から identity を作る。`seed` はマスの種類の base32 符号・開始位置・ゴールを `-` でつなぐ。
 * 例: 3×4 の盤面 `#.b` `.c.` `...` `x.x`（行ごと）で開始位置 3、ゴール 8 なら `5af044-3-8`。
 */
export function createIceFloorMazeProblemIdentity(
  problem: IceFloorMazeProblem,
): IceFloorMazeProblemIdentity {
  const { board, start, goal } = problem;
  return {
    generatorVersion: ICE_FLOOR_MAZE_GENERATOR_VERSION,
    seed: `${encodeCells(board.cells)}-${start}-${goal}`,
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

/**
 * 記録の問題で、盤面として描くマスの数。速さの基準時間に使う。
 * 今の版は seed の盤面から盤面の外を除いて数える。盤面の外を持たない初期版などは幅 × 高さ。
 */
export function countIceFloorMazeRecordedDrawnCells(
  identity: IceFloorMazeRecordedProblemIdentity,
): number {
  const { width, height } = identity.conditions;
  const problem = isIceFloorMazeProblemIdentity(identity)
    ? decodeIceFloorMazeProblem(identity.seed, identity.conditions)
    : null;
  return problem ? countIceFloorMazeDrawnCells(problem.board) : width * height;
}

export const _private = {
  decodeIceFloorMazeProblem,
};
