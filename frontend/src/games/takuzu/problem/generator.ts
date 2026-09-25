import {
  createProblemSeededRandom,
  type ProblemSeed,
} from "@/games/problem-seed";
import {
  analyzeTakuzuDifficulty,
  type TakuzuDifficultyAnalysis,
} from "@/games/takuzu/problem/difficulty-analysis";
import {
  type TakuzuTechnique,
  takuzuTechniques,
  traceTakuzuHumanSolve,
} from "@/games/takuzu/problem/generation/human-solver";
import {
  countTakuzuSolutions,
  findRandomTakuzuSolution,
} from "@/games/takuzu/problem/generation/solver";
import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import type { TakuzuBoard, TakuzuCell } from "@/games/takuzu/puzzle/board";

export const TAKUZU_BOARD_SIZE = 8;

/**
 * 問題を作る条件。同じ条件からは同じ問題を作る。
 * - `removalTechniqueLimit`: 初期配置を減らすとき、解き切れることを保つのに使ってよい最も深い手筋。
 *   `null` なら手筋で解き切れることは保たず、一意解であることだけを保つ（評価可能範囲の外の問題も作る）。
 *   生成された問題の難易度はこの値で決めず、できた問題を分析して決める。
 * - `extraGivenCount`: 減らし切った初期配置へ、解から戻すマスの数。初期配置が多めの問題を作るのに使う。
 */
export type TakuzuGenerationConditions = {
  seed: ProblemSeed;
  removalTechniqueLimit: TakuzuTechnique | null;
  extraGivenCount: number;
};

export type TakuzuGeneratedProblem = {
  problem: TakuzuProblem;
  conditions: TakuzuGenerationConditions;
  difficultyAnalysis: TakuzuDifficultyAnalysis;
};

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }
  return shuffled;
}

type GivensAcceptance = (givens: TakuzuBoard) => boolean;

/** 手筋はどれも健全なので、上限までの手筋で解き切れる初期配置は一意解になる。 */
function createGivensAcceptance(
  removalTechniqueLimit: TakuzuTechnique | null,
): GivensAcceptance {
  if (removalTechniqueLimit === null) {
    return function isUnique(givens) {
      return countTakuzuSolutions(givens).solutionCount === 1;
    };
  }
  const techniques = takuzuTechniques.slice(
    0,
    takuzuTechniques.indexOf(removalTechniqueLimit) + 1,
  );
  return function isSolvableByTechniques(givens) {
    return traceTakuzuHumanSolve(givens, { techniques }).status === "solved";
  };
}

function createEmptyBoard(size: number): TakuzuBoard {
  return { size, cells: new Array<TakuzuCell>(size * size).fill(null) };
}

/** 解の全マスを初期配置として始め、乱数で決まる順にマスを1つずつ消す。消すと条件を満たさなくなるマスは残す。 */
function removeGivens(
  solution: TakuzuBoard,
  acceptsGivens: GivensAcceptance,
  random: () => number,
): { givens: TakuzuBoard; removedCellIndices: number[] } {
  const cells: TakuzuCell[] = [...solution.cells];
  const removedCellIndices: number[] = [];
  const removalOrder = shuffle(
    cells.map((_, cellIndex) => cellIndex),
    random,
  );
  for (const cellIndex of removalOrder) {
    const tile = cells[cellIndex] ?? null;
    cells[cellIndex] = null;
    if (acceptsGivens({ size: solution.size, cells })) {
      removedCellIndices.push(cellIndex);
    } else {
      cells[cellIndex] = tile;
    }
  }
  return { givens: { size: solution.size, cells }, removedCellIndices };
}

function restoreGivens(
  givens: TakuzuBoard,
  solution: TakuzuBoard,
  cellIndices: readonly number[],
): TakuzuBoard {
  const cells = [...givens.cells];
  for (const cellIndex of cellIndices) {
    cells[cellIndex] = solution.cells[cellIndex] ?? null;
  }
  return { size: givens.size, cells };
}

/**
 * 8×8 の完成盤を作り、初期配置を減らして問題にする。
 * 難易度分析で分類するためのコーパス作成用で、難易度を指定して作る機能は持たない。
 */
export function generateTakuzuProblem(
  conditions: TakuzuGenerationConditions,
): TakuzuGeneratedProblem {
  const random = createProblemSeededRandom(`takuzu:${conditions.seed}`);
  const solution = findRandomTakuzuSolution(
    createEmptyBoard(TAKUZU_BOARD_SIZE),
    random,
  );
  if (solution === null) {
    throw new Error("An empty Takuzu board must have a solution");
  }
  const { givens: minimalGivens, removedCellIndices } = removeGivens(
    solution,
    createGivensAcceptance(conditions.removalTechniqueLimit),
    random,
  );
  const restoredCellIndices = shuffle(removedCellIndices, random).slice(
    0,
    conditions.extraGivenCount,
  );
  const problem = {
    givens: restoreGivens(minimalGivens, solution, restoredCellIndices),
    solution,
  };
  return {
    problem,
    conditions,
    difficultyAnalysis: analyzeTakuzuDifficulty(problem),
  };
}
