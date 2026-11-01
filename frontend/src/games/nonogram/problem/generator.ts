import { generateNonogramPatternCandidate } from "@/games/nonogram/problem/generation/pattern-generation";
import {
  measureNonogramPatternQuality,
  meetsNonogramPatternRequirements,
} from "@/games/nonogram/problem/generation/pattern-quality";
import { isNonogramLineSolvable } from "@/games/nonogram/problem/generation/propagation";
import { getNonogramSymmetryKey } from "@/games/nonogram/problem/generation/symmetry";
import {
  createNonogramProblem,
  isNonogramProblemIdentity,
  NONOGRAM_GENERATOR_VERSION,
  type NonogramIdentifiedProblem,
  type NonogramProblemIdentity,
} from "@/games/nonogram/problem/problem";
import { computeNonogramClues } from "@/games/nonogram/puzzle/clue";
import type { NonogramPattern } from "@/games/nonogram/puzzle/pattern";
import { createProblemSeededRandom } from "@/games/problem-seed";

/** - `symmetryKey`: 回転・反転の同型を問題集から除くための正規化キー。 */
export type NonogramGeneratedProblem = NonogramIdentifiedProblem & {
  symmetryKey: string;
};

/**
 * 図柄の候補を問題にしなかった理由。
 * - `pattern-requirements`: 図柄の条件（`nonogramPatternRequirements`）を満たさない。
 * - `not-line-solvable`: 1本ずつの線の読みだけでは全マスが決まらない（仮置きが要るか、解が複数ある）。
 */
export type NonogramCandidateRejection =
  | "pattern-requirements"
  | "not-line-solvable";

export type NonogramGenerationResult =
  | { status: "accepted"; generated: NonogramGeneratedProblem }
  | {
      status: "rejected";
      reason: NonogramCandidateRejection;
      pattern: NonogramPattern;
    };

function validateIdentity(identity: NonogramProblemIdentity): void {
  const { generatorVersion, conditions } = identity;
  if (generatorVersion !== NONOGRAM_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Nonogram generator version: ${generatorVersion}`,
    );
  }
  if (!isNonogramProblemIdentity(identity)) {
    throw new RangeError(
      `Unsupported Nonogram generation conditions: ${JSON.stringify(conditions)}`,
    );
  }
}

/**
 * 図柄を問題にしない理由を返す。問題にできる図柄なら `null`。
 * 採るのは、図柄の条件を満たし、1本ずつの線の読みだけで全マスが決まる（解がただ1つの）図柄。
 * 採否は探索をせずに決まるので、探索の打ち切りに左右されない。
 */
function findNonogramPatternRejection(
  pattern: NonogramPattern,
): NonogramCandidateRejection | null {
  if (
    !meetsNonogramPatternRequirements(measureNonogramPatternQuality(pattern))
  ) {
    return "pattern-requirements";
  }
  if (!isNonogramLineSolvable(computeNonogramClues(pattern))) {
    return "not-line-solvable";
  }
  return null;
}

/**
 * identity の seed から図柄の候補を1つ作り、問題にするか決める。作り直しはせず、同じ identity からは同じ結果になる。
 * 回転・反転の同型除外は問題集の生成で `symmetryKey` を使って行う。
 */
export function generateNonogramProblem(
  identity: NonogramProblemIdentity,
): NonogramGenerationResult {
  validateIdentity(identity);
  const { seed, conditions } = identity;
  const random = createProblemSeededRandom(`nonogram:${seed}`);
  const pattern = generateNonogramPatternCandidate(
    conditions,
    conditions,
    random,
  );
  const rejection = findNonogramPatternRejection(pattern);
  if (rejection !== null) {
    return { status: "rejected", reason: rejection, pattern };
  }
  return {
    status: "accepted",
    generated: {
      problem: createNonogramProblem(pattern),
      identity,
      symmetryKey: getNonogramSymmetryKey(pattern),
    },
  };
}

export const _private = { findNonogramPatternRejection };
