import { isInNumericRange, type NumericRange } from "@/games/difficulty";
import { removeIceFloorMazeIrrelevantRocks } from "@/games/ice-floor-maze/problem/generation/relevant-rocks";
import { getIceFloorMazeSymmetryKey } from "@/games/ice-floor-maze/problem/generation/symmetry";
import {
  createIceFloorMazeProblemIdentity,
  type IceFloorMazeBoardShape,
  type IceFloorMazeIdentifiedProblem,
  isIceFloorMazeBoardShape,
} from "@/games/ice-floor-maze/problem/problem";
import type {
  IceFloorMazeBoard,
  IceFloorMazeCell,
} from "@/games/ice-floor-maze/puzzle/board";
import { exploreIceFloorMazeStops } from "@/games/ice-floor-maze/puzzle/stop-graph";
import {
  createProblemSeededRandom,
  type ProblemRandom,
  type ProblemSeed,
} from "@/games/problem-seed";

/**
 * - `optimalMoveCount`: 開始位置からゴールで止まるまでの最少手数。
 * - `symmetryKey`: 回転・反転の同型を問題集から除くための正規化キー。
 * - `generationAttemptCount`: 採用までに作った盤面の数。
 */
export type IceFloorMazeGeneratedProblem = IceFloorMazeIdentifiedProblem & {
  optimalMoveCount: number;
  symmetryKey: string;
  generationAttemptCount: number;
};

/** 盤面と開始位置に対して、ゴールに置ける停止点。 */
export type IceFloorMazeGoalCandidate = {
  goal: number;
  optimalMoveCount: number;
};

/**
 * 岩を置いて開始位置を決めた盤面と、その盤面で選べるゴール。
 * 盤面は無関係な岩を除いてある。ゴールの候補は最少手数が提供範囲に入る停止点で、マスの番号の昇順。
 */
export type IceFloorMazeBoardCandidate = {
  board: IceFloorMazeBoard;
  start: number;
  goalCandidates: readonly IceFloorMazeGoalCandidate[];
};

/** 長い問題が出やすい密度。 */
export const ICE_FLOOR_MAZE_ROCK_DENSITY = 0.2;

/**
 * 問題として出す最少手数の範囲。1〜2手の問題は読む余地がなく、15手以上は作業の量が多いだけになりやすい。
 */
export const iceFloorMazeOptimalMoveCountRange = {
  minimum: 3,
  maximum: 14,
} as const satisfies NumericRange;

const MAXIMUM_GENERATION_ATTEMPTS = 100;

function placeRocksRandomly(
  shape: IceFloorMazeBoardShape,
  random: ProblemRandom,
): IceFloorMazeBoard {
  const cells = Array.from(
    { length: shape.width * shape.height },
    (): IceFloorMazeCell =>
      random() < ICE_FLOOR_MAZE_ROCK_DENSITY ? "rock" : "ice",
  );
  return { width: shape.width, height: shape.height, cells };
}

function chooseRandomly<T>(values: readonly T[], random: ProblemRandom): T {
  return values[Math.floor(random() * values.length)]!;
}

function validateShape(shape: IceFloorMazeBoardShape): void {
  const { width, height } = shape;
  if (!isIceFloorMazeBoardShape({ width, height })) {
    throw new RangeError(
      `Unsupported ice floor maze board shape: ${width}x${height}`,
    );
  }
}

/**
 * 岩を密度どおりにランダムに置き、氷のマスから開始位置を選び、到達できる停止点からゴールの候補を求める。
 * 氷のマスが無い盤面では `null`。ゴールの候補が無い盤面もそのまま返し、採否は呼び出し側が決める。
 */
export function generateIceFloorMazeBoardCandidate(
  shape: IceFloorMazeBoardShape,
  random: ProblemRandom,
): IceFloorMazeBoardCandidate | null {
  validateShape(shape);
  const placedBoard = placeRocksRandomly(shape, random);
  const iceCells = placedBoard.cells.flatMap((cell, cellIndex) =>
    cell === "ice" ? [cellIndex] : [],
  );
  if (iceCells.length === 0) {
    return null;
  }

  const start = chooseRandomly(iceCells, random);
  const board = removeIceFloorMazeIrrelevantRocks(placedBoard, start);
  const { moveCounts } = exploreIceFloorMazeStops(board, start);
  const goalCandidates = [...moveCounts]
    .filter(([, moveCount]) =>
      isInNumericRange(moveCount, iceFloorMazeOptimalMoveCountRange),
    )
    .map(([goal, optimalMoveCount]) => ({ goal, optimalMoveCount }))
    .sort((left, right) => left.goal - right.goal);
  return { board, start, goalCandidates };
}

/** 盤面の候補から、選んだゴールの問題を作る。 */
export function createIceFloorMazeGeneratedProblem(
  candidate: IceFloorMazeBoardCandidate,
  goalCandidate: IceFloorMazeGoalCandidate,
  generationAttemptCount: number,
): IceFloorMazeGeneratedProblem {
  const problem = {
    board: candidate.board,
    start: candidate.start,
    goal: goalCandidate.goal,
  };
  return {
    problem,
    identity: createIceFloorMazeProblemIdentity(problem),
    optimalMoveCount: goalCandidate.optimalMoveCount,
    symmetryKey: getIceFloorMazeSymmetryKey(problem),
    generationAttemptCount,
  };
}

/**
 * seed の乱数列で盤面の候補を作り、ゴールの候補がある盤面からゴールを等確率で選ぶ。
 * ゴールの候補が無ければ同じ乱数列で盤面を作り直す。同じ seed と形からは同じ問題を作る。
 * 難易度ごとにゴールを選ぶ問題集の生成では、`generateIceFloorMazeBoardCandidate` を直接使う。
 */
export function generateIceFloorMazeProblem(
  seed: ProblemSeed,
  shape: IceFloorMazeBoardShape,
): IceFloorMazeGeneratedProblem {
  validateShape(shape);
  const random = createProblemSeededRandom(
    `ice-floor-maze:${seed}:${shape.width}x${shape.height}`,
  );

  for (let attempt = 1; attempt <= MAXIMUM_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateIceFloorMazeBoardCandidate(shape, random);
    if (!candidate || candidate.goalCandidates.length === 0) {
      continue;
    }
    return createIceFloorMazeGeneratedProblem(
      candidate,
      chooseRandomly(candidate.goalCandidates, random),
      attempt,
    );
  }
  throw new Error(
    `Could not generate an ice floor maze problem for seed ${seed} within ${MAXIMUM_GENERATION_ATTEMPTS} attempts`,
  );
}
