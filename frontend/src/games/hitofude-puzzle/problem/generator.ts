import { createHitofudePuzzleHoleBoard } from "@/games/hitofude-puzzle/problem/generation/hole-annealing";
import { getHitofudePuzzleSymmetryKey } from "@/games/hitofude-puzzle/problem/generation/symmetry";
import {
  HITOFUDE_PUZZLE_GENERATOR_VERSION,
  type HitofudePuzzleIdentifiedProblem,
  type HitofudePuzzleProblemIdentity,
  isHitofudePuzzleBoardSize,
  isHitofudePuzzleTargetLookaheadLoad,
} from "@/games/hitofude-puzzle/problem/problem";
import { createProblemSeededRandom } from "@/games/problem-seed";

export type HitofudePuzzleGeneratedProblem = HitofudePuzzleIdentifiedProblem & {
  /** 問題のただ1つの解の道。問題集の分析と検証に使い、プレイには渡さない。 */
  solution: readonly number[];
  /** 回転・反転の同型を問題集から除くための正規化キー。 */
  symmetryKey: string;
  /** 採用までに穴の焼きなましを始めた回数。 */
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
  const { size, targetLookaheadLoad } = identity.conditions;
  if (!isHitofudePuzzleBoardSize(size)) {
    throw new RangeError(`Unsupported Hitofude puzzle board size: ${size}`);
  }
  if (!isHitofudePuzzleTargetLookaheadLoad(targetLookaheadLoad)) {
    throw new RangeError(
      `Unsupported Hitofude puzzle target lookahead load: ${targetLookaheadLoad}`,
    );
  }
}

/** 回転・反転の同型除外は問題集の生成で `symmetryKey` を使って行う。 */
export function generateHitofudePuzzleProblem(
  identity: HitofudePuzzleProblemIdentity,
): HitofudePuzzleGeneratedProblem {
  validateIdentity(identity);
  const { seed, conditions } = identity;
  const random = createProblemSeededRandom(`hitofude-puzzle:${seed}`);

  for (let attempt = 1; attempt <= MAXIMUM_GENERATION_ATTEMPTS; attempt += 1) {
    const generated = createHitofudePuzzleHoleBoard(
      conditions.size,
      conditions.targetLookaheadLoad,
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
