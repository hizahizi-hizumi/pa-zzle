import { growBridgesIslandTree } from "@/games/bridges/problem/generation/island-tree";
import { getBridgesSymmetryKey } from "@/games/bridges/problem/generation/symmetry";
import {
  BRIDGES_GENERATOR_VERSION,
  type BridgesIdentifiedProblem,
  type BridgesProblemIdentity,
  isBridgesGenerationConditions,
} from "@/games/bridges/problem/problem";
import { createProblemSeededRandom } from "@/games/problem-seed";

/**
 * 生成器が返す1つの候補。一意解かどうか・レベルは、問題集の生成で分析・分類して決める。
 * - `solution`: 作ったときの橋（辺ごとの本数）。一意解の問題では唯一の解。問題集の分析と検証に使い、プレイには渡さない。
 * - `symmetryKey`: 回転・反転の同型を問題集から除くための正規化キー。
 * - `generationAttemptCount`: 島を2つ以上置けるまで木を育て直した回数。
 */
export type BridgesGeneratedProblem = BridgesIdentifiedProblem & {
  solution: readonly number[];
  symmetryKey: string;
  generationAttemptCount: number;
};

/** 木を育て直す回数の上限。6×6 でも1回で島が2つ以上になるので、届けば生成器の不具合とみなす。 */
const MAXIMUM_GENERATION_ATTEMPTS = 20;

function validateIdentity(identity: BridgesProblemIdentity): void {
  if (identity.generatorVersion !== BRIDGES_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported Bridges generator version: ${identity.generatorVersion}`,
    );
  }
  if (!isBridgesGenerationConditions(identity.conditions)) {
    throw new RangeError(
      `Unsupported Bridges generation conditions: ${JSON.stringify(identity.conditions)}`,
    );
  }
}

/**
 * identity の seed から、完成グラフ先行で1つの候補を作る（`growBridgesIslandTree`）。同じ identity からは同じ候補を作る。
 * 一意解であることは保証しない。
 */
export function generateBridgesProblem(
  identity: BridgesProblemIdentity,
): BridgesGeneratedProblem {
  validateIdentity(identity);
  const random = createProblemSeededRandom(`bridges:${identity.seed}`);
  for (let attempt = 1; attempt <= MAXIMUM_GENERATION_ATTEMPTS; attempt += 1) {
    const layout = growBridgesIslandTree(identity.conditions, random);
    if (layout === null) {
      continue;
    }
    return {
      problem: layout.board,
      identity,
      solution: layout.solution,
      symmetryKey: getBridgesSymmetryKey(layout.board),
      generationAttemptCount: attempt,
    };
  }
  throw new Error(
    `Could not generate a Bridges problem for seed ${identity.seed} within ${MAXIMUM_GENERATION_ATTEMPTS} attempts`,
  );
}
