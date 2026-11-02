import { placeHamiltonianPathPartitions } from "@/games/hamiltonian-path/problem/generation/partition-placement";
import { createRandomSelfAvoidingWalk } from "@/games/hamiltonian-path/problem/generation/self-avoiding-walk";
import { getHamiltonianPathSymmetryKey } from "@/games/hamiltonian-path/problem/generation/symmetry";
import {
  HAMILTONIAN_PATH_GENERATOR_VERSION,
  type HamiltonianPathIdentifiedProblem,
  type HamiltonianPathProblemIdentity,
  isHamiltonianPathBoardSize,
  isHamiltonianPathWallRatio,
} from "@/games/hamiltonian-path/problem/problem";
import { createProblemSeededRandom } from "@/games/problem-seed";

/**
 * - `solution`: 問題のただ1つの解の道。問題集の分析と検証に使い、プレイには渡さない。
 * - `symmetryKey`: 回転・反転の同型を問題集から除くための正規化キー。
 * - `generationAttemptCount`: 採用までに作った候補の道の数。
 */
export type HamiltonianPathGeneratedProblem =
  HamiltonianPathIdentifiedProblem & {
    solution: readonly number[];
    symmetryKey: string;
    generationAttemptCount: number;
  };

const MAXIMUM_GENERATION_ATTEMPTS = 100;

function validateIdentity(identity: HamiltonianPathProblemIdentity): void {
  if (identity.generatorVersion !== HAMILTONIAN_PATH_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Hamiltonian path generator version: ${identity.generatorVersion}`,
    );
  }
  const { size, wallRatio } = identity.conditions;
  if (!isHamiltonianPathBoardSize(size)) {
    throw new RangeError(`Unsupported Hamiltonian path board size: ${size}`);
  }
  if (!isHamiltonianPathWallRatio(wallRatio)) {
    throw new RangeError(
      `Unsupported Hamiltonian path wall ratio: ${wallRatio}`,
    );
  }
}

/**
 * identity の seed から完成した解の道を先に作り、その道だけが解になるよう仕切りを置いて問題にする。
 * 解の道は、盤面のうち壁率を除いた数のマスを通る無作為な自己回避路で、通らないマスが壁マス、道の先頭が始点になる。
 * 探索量の上限で一意にし切れない候補は捨て、同じ乱数列で次の候補を作る。同じ identity からは同じ問題を作る。
 * 回転・反転の同型除外は問題集の生成で `symmetryKey` を使って行う。
 */
export function generateHamiltonianPathProblem(
  identity: HamiltonianPathProblemIdentity,
): HamiltonianPathGeneratedProblem {
  validateIdentity(identity);
  const { seed, conditions } = identity;
  const { size, wallRatio } = conditions;
  const random = createProblemSeededRandom(`hamiltonian-path:${seed}`);
  const cellCount = size * size;
  const openCellCount = Math.round(cellCount * (1 - wallRatio));

  for (let attempt = 1; attempt <= MAXIMUM_GENERATION_ATTEMPTS; attempt += 1) {
    const solution = createRandomSelfAvoidingWalk(size, openCellCount, random);
    const openCells = new Set(solution);
    const walls = Array.from({ length: cellCount }, (_, cell) => cell).filter(
      (cell) => !openCells.has(cell),
    );
    const board = { size, walls, start: solution[0]! };
    const partitions = placeHamiltonianPathPartitions(board, solution, random);
    if (partitions === null) {
      continue;
    }
    const problem = { ...board, partitions };
    return {
      problem,
      identity,
      solution,
      symmetryKey: getHamiltonianPathSymmetryKey(problem),
      generationAttemptCount: attempt,
    };
  }
  throw new Error(
    `Could not generate a Hamiltonian path problem for seed ${seed} within ${MAXIMUM_GENERATION_ATTEMPTS} attempts`,
  );
}
