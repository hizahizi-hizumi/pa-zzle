import {
  createProblemSeededRandom,
  type ProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";
import { doAllReflectionPiecesInfluenceClues } from "@/games/reflection/problem/generation/piece-influence";
import { countReflectionSolutions } from "@/games/reflection/problem/generation/solver";
import { getReflectionSymmetryKey } from "@/games/reflection/problem/generation/symmetry";
import {
  isReflectionBoardSize,
  isReflectionPieceCount,
  REFLECTION_GENERATOR_VERSION,
  type ReflectionIdentifiedProblem,
  type ReflectionProblemIdentity,
} from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  type ReflectionBoard,
  type ReflectionCell,
  type ReflectionPiece,
  reflectionPieces,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";

/**
 * - `symmetryKey`: 回転・反転の同型を問題集から除くための正規化キー。
 * - `generationAttemptCount`: 採用までに作った候補配置の数。
 */
export type ReflectionGeneratedProblem = ReflectionIdentifiedProblem & {
  symmetryKey: string;
  generationAttemptCount: number;
};

/**
 * 1候補あたりの一意性判定の探索量の上限。7×7・12ピースまでの候補は5千節点以内で判定が終わるので、十分な余裕を持たせている。
 * 上限に達した候補は一意とみなさず捨てる。
 */
const REFLECTION_UNIQUENESS_SEARCH_STEP_LIMIT = 200_000;

const MAXIMUM_GENERATION_ATTEMPTS = 100;

/**
 * 手持ちの各ピースを6種から等確率で選ぶ。同じ種類が重なってもよい。
 * 特定の種類を必ず含めると、ピースが少ない問題で種類の組み合わせが偏り、1本のヒントで決まる問題がほとんど出なくなる。
 */
function sampleInventoryPieces(
  pieceCount: number,
  random: ProblemRandom,
): ReflectionPiece[] {
  return Array.from(
    { length: pieceCount },
    () => reflectionPieces[Math.floor(random() * reflectionPieces.length)]!,
  );
}

function placePiecesRandomly(
  size: number,
  pieces: readonly ReflectionPiece[],
  random: ProblemRandom,
): ReflectionBoard {
  const cells = new Array<ReflectionCell>(size * size).fill(null);
  const cellIndices = shuffleProblemValues(
    cells.map((_, cellIndex) => cellIndex),
    random,
  );
  for (const [order, piece] of pieces.entries()) {
    cells[cellIndices[order]!] = piece;
  }
  return { size, cells };
}

function isUniquelySolvable(board: ReflectionBoard): boolean {
  const result = countReflectionSolutions(
    {
      size: board.size,
      inventory: countReflectionBoardPieces(board),
      clues: computeReflectionClues(board),
    },
    { searchStepLimit: REFLECTION_UNIQUENESS_SEARCH_STEP_LIMIT },
  );
  return result.status === "complete" && result.solutionCount === 1;
}

function validateIdentity(identity: ReflectionProblemIdentity): void {
  if (identity.generatorVersion !== REFLECTION_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Reflection generator version: ${identity.generatorVersion}`,
    );
  }
  const { size, pieceCount } = identity.conditions;
  if (!isReflectionBoardSize(size)) {
    throw new RangeError(`Unsupported Reflection board size: ${size}`);
  }
  if (!isReflectionPieceCount(size, pieceCount)) {
    throw new RangeError(
      "pieceCount must be a positive integer smaller than the cell count",
    );
  }
}

/**
 * identity の seed から手持ちとその配置を乱数で作り、問題成立条件を満たすまで作り直す。
 * 問題成立条件は、全ピースがいずれかの外周ヒントに影響し、手持ちと外周ヒントに合う配置がただ1つであること。
 * 同じ identity からは同じ問題を作る。回転・反転の同型除外は問題集の生成で `symmetryKey` を使って行う。
 */
export function generateReflectionProblem(
  identity: ReflectionProblemIdentity,
): ReflectionGeneratedProblem {
  validateIdentity(identity);
  const { seed, conditions } = identity;
  const random = createProblemSeededRandom(`reflection:${seed}`);

  for (let attempt = 1; attempt <= MAXIMUM_GENERATION_ATTEMPTS; attempt += 1) {
    const pieces = sampleInventoryPieces(conditions.pieceCount, random);
    const solution = placePiecesRandomly(conditions.size, pieces, random);
    if (
      !doAllReflectionPiecesInfluenceClues(solution) ||
      !isUniquelySolvable(solution)
    ) {
      continue;
    }
    return {
      problem: {
        size: conditions.size,
        inventory: countReflectionBoardPieces(solution),
        clues: computeReflectionClues(solution),
        solution,
      },
      identity,
      symmetryKey: getReflectionSymmetryKey(solution),
      generationAttemptCount: attempt,
    };
  }
  throw new Error(
    `Could not generate a Reflection problem for seed ${seed} within ${MAXIMUM_GENERATION_ATTEMPTS} attempts`,
  );
}
