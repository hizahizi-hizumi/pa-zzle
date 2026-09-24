import {
  FIFTEEN_PUZZLE_GENERATOR_VERSION,
  type FifteenPuzzleGeneratedProblem,
  type FifteenPuzzleGenerationConditions,
  type FifteenPuzzleProblemIdentity,
} from "@/games/fifteen-puzzle/problem/problem";
import {
  applyFifteenPuzzleSlide,
  getFifteenPuzzleSlide,
  listFifteenPuzzleSingleMoves,
} from "@/games/fifteen-puzzle/puzzle/rules";
import {
  createSolvedFifteenPuzzleBoard,
  FIFTEEN_PUZZLE_SIZE,
  type FifteenPuzzleBoard,
  findFifteenPuzzleBlankIndex,
} from "@/games/fifteen-puzzle/puzzle/state";
import {
  createProblemSeededRandom,
  type ProblemSeed,
} from "@/games/problem-seed";

export type FifteenPuzzleRestoredProblem = Pick<
  FifteenPuzzleGeneratedProblem,
  "problem" | "identity"
>;

function validateGenerationConditions(
  conditions: FifteenPuzzleGenerationConditions,
): void {
  if (conditions.size !== FIFTEEN_PUZZLE_SIZE) {
    throw new Error("Unsupported fifteen puzzle generation conditions");
  }

  if (
    !Number.isInteger(conditions.scrambleLength) ||
    conditions.scrambleLength < 1
  ) {
    throw new RangeError("scrambleLength must be a positive integer");
  }
}

function createGeneratorRandom(
  seed: ProblemSeed,
  conditions: FifteenPuzzleGenerationConditions,
): () => number {
  return createProblemSeededRandom(
    [
      FIFTEEN_PUZZLE_GENERATOR_VERSION,
      seed,
      conditions.size,
      conditions.scrambleLength,
    ].join(":"),
  );
}

/**
 * 完成盤面から、直前の手を打ち消さない合法手を seed に従って打つ。
 * 完成盤面から合法手だけでたどるので、生成した盤面は常に可解になる。
 */
export function generateFifteenPuzzleBoard(
  seed: ProblemSeed,
  conditions: FifteenPuzzleGenerationConditions,
): FifteenPuzzleBoard {
  validateGenerationConditions(conditions);

  const random = createGeneratorRandom(seed, conditions);
  let board = createSolvedFifteenPuzzleBoard();
  let previousBlankIndex: number | null = null;

  for (let step = 0; step < conditions.scrambleLength; step += 1) {
    const candidates = listFifteenPuzzleSingleMoves(board).filter(
      (tileIndex) => tileIndex !== previousBlankIndex,
    );
    const tileIndex = candidates[Math.floor(random() * candidates.length)];
    const slide =
      tileIndex === undefined ? null : getFifteenPuzzleSlide(board, tileIndex);
    if (!slide) {
      throw new Error("Fifteen puzzle scramble has no legal move");
    }

    previousBlankIndex = findFifteenPuzzleBlankIndex(board);
    board = applyFifteenPuzzleSlide(board, slide);
  }

  return board;
}

export function restoreFifteenPuzzleProblem(
  identity: FifteenPuzzleProblemIdentity,
): FifteenPuzzleRestoredProblem {
  if (identity.generatorVersion !== FIFTEEN_PUZZLE_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported fifteen puzzle generator version: ${identity.generatorVersion}`,
    );
  }

  return {
    problem: {
      initialBoard: generateFifteenPuzzleBoard(
        identity.seed,
        identity.conditions,
      ),
    },
    identity,
  };
}
