import { createHamiltonianPathHoleBoard } from "@/games/hamiltonian-path/problem/generation/hole-annealing";
import { getHamiltonianPathSymmetryKey } from "@/games/hamiltonian-path/problem/generation/symmetry";
import {
  HAMILTONIAN_PATH_GENERATOR_VERSION,
  type HamiltonianPathIdentifiedProblem,
  type HamiltonianPathProblemIdentity,
  isHamiltonianPathBoardSize,
  isHamiltonianPathTargetAssumptionCount,
} from "@/games/hamiltonian-path/problem/problem";
import { createProblemSeededRandom } from "@/games/problem-seed";

/**
 * - `solution`: 問題のただ1つの解の道。問題集の分析と検証に使い、プレイには渡さない。
 * - `symmetryKey`: 回転・反転の同型を問題集から除くための正規化キー。
 * - `generationAttemptCount`: 採用までに穴の焼きなましを始めた回数。
 */
export type HamiltonianPathGeneratedProblem =
  HamiltonianPathIdentifiedProblem & {
    solution: readonly number[];
    symmetryKey: string;
    generationAttemptCount: number;
  };

/** 焼きなましを始め直す回数の上限。8×8 でも1回で一意解に着く割合は8割を超えるので、届けば生成器の不具合とみなす。 */
const MAXIMUM_GENERATION_ATTEMPTS = 20;

function validateIdentity(identity: HamiltonianPathProblemIdentity): void {
  if (identity.generatorVersion !== HAMILTONIAN_PATH_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Hamiltonian path generator version: ${identity.generatorVersion}`,
    );
  }
  const { size, targetAssumptionCount } = identity.conditions;
  if (!isHamiltonianPathBoardSize(size)) {
    throw new RangeError(`Unsupported Hamiltonian path board size: ${size}`);
  }
  if (!isHamiltonianPathTargetAssumptionCount(targetAssumptionCount)) {
    throw new RangeError(
      `Unsupported Hamiltonian path target assumption count: ${targetAssumptionCount}`,
    );
  }
}

/**
 * identity の seed から、穴だけで一意解にした問題を作る（`createHamiltonianPathHoleBoard`）。
 * 焼きなましが一意解に着かなければ、同じ乱数列の続きで始め直す。同じ identity からは同じ問題を作る。
 * 回転・反転の同型除外は問題集の生成で `symmetryKey` を使って行う。
 */
export function generateHamiltonianPathProblem(
  identity: HamiltonianPathProblemIdentity,
): HamiltonianPathGeneratedProblem {
  validateIdentity(identity);
  const { seed, conditions } = identity;
  const random = createProblemSeededRandom(`hamiltonian-path:${seed}`);

  for (let attempt = 1; attempt <= MAXIMUM_GENERATION_ATTEMPTS; attempt += 1) {
    const generated = createHamiltonianPathHoleBoard(
      conditions.size,
      conditions.targetAssumptionCount,
      random,
    );
    if (generated === null) {
      continue;
    }
    return {
      problem: generated.board,
      identity,
      solution: generated.solution,
      symmetryKey: getHamiltonianPathSymmetryKey(generated.board),
      generationAttemptCount: attempt,
    };
  }
  throw new Error(
    `Could not generate a Hamiltonian path problem for seed ${seed} within ${MAXIMUM_GENERATION_ATTEMPTS} attempts`,
  );
}
