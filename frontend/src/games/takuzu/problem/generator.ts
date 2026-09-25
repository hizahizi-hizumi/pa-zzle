import { createProblemSeededRandom } from "@/games/problem-seed";
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
import {
  TAKUZU_BOARD_SIZE,
  TAKUZU_GENERATOR_VERSION,
  type TakuzuIdentifiedProblem,
  type TakuzuProblemIdentity,
} from "@/games/takuzu/problem/problem";
import type { TakuzuBoard, TakuzuCell } from "@/games/takuzu/puzzle/board";

export type TakuzuGeneratedProblem = TakuzuIdentifiedProblem & {
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

function validateIdentity(identity: TakuzuProblemIdentity): void {
  if (identity.generatorVersion !== TAKUZU_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Takuzu generator version: ${identity.generatorVersion}`,
    );
  }
  if (identity.conditions.size !== TAKUZU_BOARD_SIZE) {
    throw new RangeError(
      `Unsupported Takuzu board size: ${identity.conditions.size}`,
    );
  }
  const { extraGivenCount } = identity.conditions;
  if (!Number.isInteger(extraGivenCount) || extraGivenCount < 0) {
    throw new RangeError("extraGivenCount must be a non-negative integer");
  }
}

/**
 * identity の seed から 8×8 の完成盤を作り、初期配置を減らして問題にし、難易度を分析する。
 * 同じ identity からは同じ問題を作る。難易度を指定して作る機能は持たず、
 * 問題集の生成スクリプトが、できた問題を分類して各難易度へ振り分ける。
 */
export function generateTakuzuProblem(
  identity: TakuzuProblemIdentity,
): TakuzuGeneratedProblem {
  validateIdentity(identity);
  const { seed, conditions } = identity;
  const random = createProblemSeededRandom(`takuzu:${seed}`);
  const solution = findRandomTakuzuSolution(
    createEmptyBoard(conditions.size),
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
    identity,
    difficultyAnalysis: analyzeTakuzuDifficulty(problem),
  };
}
