import {
  createProblemSeededRandom,
  type ProblemSeed,
} from "@/games/problem-seed";
import {
  getMinesweeperNeighborCellIndices,
  type MinesweeperBoard,
} from "@/games/minesweeper/puzzle/board";
import { collectMinesweeperRevealCellIndices } from "@/games/minesweeper/puzzle/rules";
import {
  analyzeMinesweeperDifficulty,
  type MinesweeperDifficultyAnalysis,
} from "@/games/minesweeper/problem/difficulty-analysis";
import type { MinesweeperHumanSolverOptions } from "@/games/minesweeper/problem/generation/human-solver";
import {
  MINESWEEPER_GENERATOR_VERSION,
  type MinesweeperGenerationConditions,
  type MinesweeperProblem,
  type MinesweeperProblemIdentity,
} from "@/games/minesweeper/problem/problem";

export const MINESWEEPER_MINIMUM_BOARD_LENGTH = 5;
export const MINESWEEPER_MAXIMUM_BOARD_ROWS = 16;
export const MINESWEEPER_MAXIMUM_BOARD_COLUMNS = 12;

// 開始マスの位置によらず同じ地雷数を置けるよう、開始の3×3が盤面に収まる場合の9マスを常に空けておく。
const START_AREA_CELL_COUNT = 9;

/** 再現用情報から復元した問題。難易度分析を伴わない。 */
export type MinesweeperRestoredProblem = {
  problem: MinesweeperProblem;
  identity: MinesweeperProblemIdentity;
};

export type MinesweeperGeneratedProblem = MinesweeperRestoredProblem & {
  difficultyAnalysis: MinesweeperDifficultyAnalysis;
};

export type MinesweeperGeneratedCandidate = {
  attempt: number;
  problem: MinesweeperProblem;
  difficultyAnalysis: MinesweeperDifficultyAnalysis;
};

export type MinesweeperProblemAcceptance = (
  candidate: MinesweeperGeneratedCandidate,
) => boolean;

export type MinesweeperGeneratorOptions = {
  seed: ProblemSeed;
  conditions: MinesweeperGenerationConditions;
  maximumAttempts?: number;
  analysisOptions?: MinesweeperHumanSolverOptions;
  acceptCandidate?: MinesweeperProblemAcceptance;
};

export class MinesweeperGenerationExhaustedError extends Error {
  constructor(maximumAttempts: number) {
    super(
      `Failed to generate a minesweeper problem within ${maximumAttempts} attempts`,
    );
    this.name = "MinesweeperGenerationExhaustedError";
  }
}

function createGeneratorRandom(
  seed: ProblemSeed,
  conditions: MinesweeperGenerationConditions,
): () => number {
  return createProblemSeededRandom(
    [
      MINESWEEPER_GENERATOR_VERSION,
      seed,
      conditions.rows,
      conditions.columns,
      conditions.mineCount,
      conditions.startCellPlacement,
    ].join(":"),
  );
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }

  return shuffled;
}

function validateIntegerInRange(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }
}

function validateConditions(conditions: MinesweeperGenerationConditions): void {
  validateIntegerInRange(
    "rows",
    conditions.rows,
    MINESWEEPER_MINIMUM_BOARD_LENGTH,
    MINESWEEPER_MAXIMUM_BOARD_ROWS,
  );
  validateIntegerInRange(
    "columns",
    conditions.columns,
    MINESWEEPER_MINIMUM_BOARD_LENGTH,
    MINESWEEPER_MAXIMUM_BOARD_COLUMNS,
  );
  validateIntegerInRange(
    "mineCount",
    conditions.mineCount,
    1,
    conditions.rows * conditions.columns - START_AREA_CELL_COUNT,
  );
  if (
    conditions.startCellPlacement !== "random" &&
    conditions.startCellPlacement !== "center"
  ) {
    throw new Error(
      `Unsupported start cell placement: ${conditions.startCellPlacement}`,
    );
  }
}

function validateMaximumAttempts(maximumAttempts: number): void {
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be a positive integer");
  }
}

function validateProblemIdentity(identity: MinesweeperProblemIdentity): void {
  if (identity.generatorVersion !== MINESWEEPER_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported minesweeper generator version: ${identity.generatorVersion}`,
    );
  }

  validateConditions(identity.conditions);
  if (
    !Number.isInteger(identity.generationAttempt) ||
    identity.generationAttempt < 1
  ) {
    throw new RangeError("generationAttempt must be a positive integer");
  }
}

function chooseStartCellIndex(
  conditions: MinesweeperGenerationConditions,
  random: () => number,
): number {
  if (conditions.startCellPlacement === "center") {
    return (
      Math.floor((conditions.rows - 1) / 2) * conditions.columns +
      Math.floor((conditions.columns - 1) / 2)
    );
  }
  return Math.floor(random() * conditions.rows * conditions.columns);
}

function createProblemCandidate(
  conditions: MinesweeperGenerationConditions,
  random: () => number,
): MinesweeperProblem {
  const { rows, columns, mineCount } = conditions;
  const emptyBoard: MinesweeperBoard = { rows, columns, mineCellIndices: [] };
  const startCellIndex = chooseStartCellIndex(conditions, random);
  const startAreaCells = new Set([
    startCellIndex,
    ...getMinesweeperNeighborCellIndices(emptyBoard, startCellIndex),
  ]);
  const mineCandidateCells = Array.from(
    { length: rows * columns },
    (_, cellIndex) => cellIndex,
  ).filter((cellIndex) => !startAreaCells.has(cellIndex));
  const board: MinesweeperBoard = {
    rows,
    columns,
    mineCellIndices: shuffle(mineCandidateCells, random)
      .slice(0, mineCount)
      .sort((left, right) => left - right),
  };

  return {
    board,
    initialRevealedCellIndices: collectMinesweeperRevealCellIndices(board, [
      startCellIndex,
    ]),
  };
}

function findCandidateAtAttempt(
  identity: MinesweeperProblemIdentity,
): MinesweeperProblem {
  const random = createGeneratorRandom(identity.seed, identity.conditions);
  let problem = createProblemCandidate(identity.conditions, random);
  for (let attempt = 2; attempt <= identity.generationAttempt; attempt += 1) {
    problem = createProblemCandidate(identity.conditions, random);
  }
  return problem;
}

/** 再現用情報から盤面だけを復元する。難易度分析を走らせないため、分類済みの問題を遊ぶときに使う。 */
export function restoreMinesweeperProblemWithoutAnalysis(
  identity: MinesweeperProblemIdentity,
): MinesweeperRestoredProblem {
  validateProblemIdentity(identity);

  return { problem: findCandidateAtAttempt(identity), identity };
}

export function restoreMinesweeperProblem(
  identity: MinesweeperProblemIdentity,
  analysisOptions: MinesweeperHumanSolverOptions = {},
): MinesweeperGeneratedProblem {
  const restored = restoreMinesweeperProblemWithoutAnalysis(identity);
  return {
    ...restored,
    difficultyAnalysis: analyzeMinesweeperDifficulty(
      restored.problem,
      analysisOptions,
    ),
  };
}

/**
 * 条件に合う候補を seed から決定的に作り、難易度を分析して `acceptCandidate` が採用した最初の候補を返す。
 * 開始マスとその周囲には地雷を置かず、開始マスから0連鎖で開く範囲を初期開示とする。
 */
export function generateMinesweeperProblem(
  options: MinesweeperGeneratorOptions,
): MinesweeperGeneratedProblem {
  validateConditions(options.conditions);
  const maximumAttempts = options.maximumAttempts ?? 100;
  validateMaximumAttempts(maximumAttempts);

  const random = createGeneratorRandom(options.seed, options.conditions);
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const problem = createProblemCandidate(options.conditions, random);
    const difficultyAnalysis = analyzeMinesweeperDifficulty(
      problem,
      options.analysisOptions,
    );
    if (
      options.acceptCandidate &&
      !options.acceptCandidate({ attempt, problem, difficultyAnalysis })
    ) {
      continue;
    }

    return {
      problem,
      identity: {
        generatorVersion: MINESWEEPER_GENERATOR_VERSION,
        seed: options.seed,
        conditions: { ...options.conditions },
        generationAttempt: attempt,
      },
      difficultyAnalysis,
    };
  }

  throw new MinesweeperGenerationExhaustedError(maximumAttempts);
}
