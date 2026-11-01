import { createHitofudePuzzleHoleBoard } from "@/games/hitofude-puzzle/problem/generation/hole-annealing";
import { getHitofudePuzzleSymmetryKey } from "@/games/hitofude-puzzle/problem/generation/symmetry";
import {
  HITOFUDE_PUZZLE_GENERATOR_VERSION,
  type HitofudePuzzleIdentifiedProblem,
  type HitofudePuzzleProblemIdentity,
  isHitofudePuzzleBoardSize,
  isHitofudePuzzleTargetAssumptionCount,
} from "@/games/hitofude-puzzle/problem/problem";
import { createProblemSeededRandom } from "@/games/problem-seed";

/**
 * - `solution`: 問題のただ1つの解の道。問題集の分析と検証に使い、プレイには渡さない。
 * - `symmetryKey`: 回転・反転の同型を問題集から除くための正規化キー。
 * - `generationAttemptCount`: 採用までに穴の焼きなましを始めた回数。
 */
export type HitofudePuzzleGeneratedProblem = HitofudePuzzleIdentifiedProblem & {
  solution: readonly number[];
  symmetryKey: string;
  generationAttemptCount: number;
};

/** 焼きなましを始め直す回数の上限。8×8 でも1回で一意解に着く割合は8割を超えるので、届けば生成器の不具合とみなす。 */
const MAXIMUM_GENERATION_ATTEMPTS = 20;

function validateIdentity(identity: HitofudePuzzleProblemIdentity): void {
  if (identity.generatorVersion !== HITOFUDE_PUZZLE_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Hitofude puzzle generator version: ${identity.generatorVersion}`,
    );
  }
  const { size, targetAssumptionCount } = identity.conditions;
  if (!isHitofudePuzzleBoardSize(size)) {
    throw new RangeError(`Unsupported Hitofude puzzle board size: ${size}`);
  }
  if (!isHitofudePuzzleTargetAssumptionCount(targetAssumptionCount)) {
    throw new RangeError(
      `Unsupported Hitofude puzzle target assumption count: ${targetAssumptionCount}`,
    );
  }
}

/**
 * identity の seed から、穴だけで一意解にした問題を作る（`createHitofudePuzzleHoleBoard`）。
 * 焼きなましが一意解に着かなければ、同じ乱数列の続きで始め直す。同じ identity からは同じ問題を作る。
 * 回転・反転の同型除外は問題集の生成で `symmetryKey` を使って行う。
 */
export function generateHitofudePuzzleProblem(
  identity: HitofudePuzzleProblemIdentity,
): HitofudePuzzleGeneratedProblem {
  validateIdentity(identity);
  const { seed, conditions } = identity;
  // 乱数列の接頭辞は、内部ID を `hitofude-puzzle` へ変える前の `hamiltonian-path` のまま固定する。
  // 変えると同じ identity から別の問題ができ、生成器の版を上げない限り問題集と合わなくなる。
  const random = createProblemSeededRandom(`hamiltonian-path:${seed}`);

  for (let attempt = 1; attempt <= MAXIMUM_GENERATION_ATTEMPTS; attempt += 1) {
    const generated = createHitofudePuzzleHoleBoard(
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
      symmetryKey: getHitofudePuzzleSymmetryKey(generated.board),
      generationAttemptCount: attempt,
    };
  }
  throw new Error(
    `Could not generate a Hitofude puzzle problem for seed ${seed} within ${MAXIMUM_GENERATION_ATTEMPTS} attempts`,
  );
}
