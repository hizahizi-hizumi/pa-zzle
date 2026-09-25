import {
  createProblemSeededRandom,
  type ProblemSeed,
} from "@/games/problem-seed";
import {
  SLIDE_PUZZLE_GENERATOR_VERSION,
  type SlidePuzzleGeneratedProblem,
  type SlidePuzzleGenerationConditions,
  type SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  listSlidePuzzleSingleMoves,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  createSolvedSlidePuzzleBoard,
  findSlidePuzzleBlankIndex,
  isSlidePuzzleBoardSize,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";

function validateGenerationConditions(
  conditions: SlidePuzzleGenerationConditions,
): void {
  if (!isSlidePuzzleBoardSize(conditions.size)) {
    throw new Error("Unsupported slide puzzle generation conditions");
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
  conditions: SlidePuzzleGenerationConditions,
): () => number {
  return createProblemSeededRandom(
    [
      SLIDE_PUZZLE_GENERATOR_VERSION,
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
export function generateSlidePuzzleBoard(
  seed: ProblemSeed,
  conditions: SlidePuzzleGenerationConditions,
): SlidePuzzleBoard {
  validateGenerationConditions(conditions);

  const random = createGeneratorRandom(seed, conditions);
  let board = createSolvedSlidePuzzleBoard(conditions.size);
  let previousBlankIndex: number | null = null;

  for (let step = 0; step < conditions.scrambleLength; step += 1) {
    const candidates = listSlidePuzzleSingleMoves(board).filter(
      (tileIndex) => tileIndex !== previousBlankIndex,
    );
    const tileIndex = candidates[Math.floor(random() * candidates.length)];
    const slide =
      tileIndex === undefined ? null : getSlidePuzzleSlide(board, tileIndex);
    if (!slide) {
      throw new Error("Slide puzzle scramble has no legal move");
    }

    previousBlankIndex = findSlidePuzzleBlankIndex(board);
    board = applySlidePuzzleSlide(board, slide);
  }

  return board;
}

export function restoreSlidePuzzleProblem(
  identity: SlidePuzzleProblemIdentity,
): SlidePuzzleGeneratedProblem {
  if (identity.generatorVersion !== SLIDE_PUZZLE_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported slide puzzle generator version: ${identity.generatorVersion}`,
    );
  }

  return {
    problem: {
      initialBoard: generateSlidePuzzleBoard(
        identity.seed,
        identity.conditions,
      ),
    },
    identity,
  };
}
