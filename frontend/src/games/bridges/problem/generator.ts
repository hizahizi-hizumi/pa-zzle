import { spreadBridgesIslands } from "@/games/bridges/problem/generation/island-spread";
import { refineBridgesLayout } from "@/games/bridges/problem/generation/refinement";
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
 * - `generationAttemptCount`: 島を2つ以上置き、上下左右の端の行・列のどれにも島がある盤面になり、磨くなら磨いた盤面が
 *   一意解になるまで作り直した回数。
 */
export type BridgesGeneratedProblem = BridgesIdentifiedProblem & {
  solution: readonly number[];
  symmetryKey: string;
  generationAttemptCount: number;
};

/**
 * 作り直す回数の上限。上下左右の端の行・列のどれにも島がある盤面になり、磨くなら磨いた盤面が一意解になるまで作り直す。
 * 届けば生成器の不具合とみなす。
 */
const MAXIMUM_GENERATION_ATTEMPTS = 200;

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
 * identity の seed から、島を盤面に広げながら橋を張って1つの候補を作り（`spreadBridgesIslands`）、磨く回数があれば
 * 人が読む量の多い盤面へ磨く（`refineBridgesLayout`）。同じ identity からは同じ候補を作る。
 * 磨かない候補は一意解であることを保証しない。
 */
export function generateBridgesProblem(
  identity: BridgesProblemIdentity,
): BridgesGeneratedProblem {
  validateIdentity(identity);
  const random = createProblemSeededRandom(`bridges:${identity.seed}`);
  for (let attempt = 1; attempt <= MAXIMUM_GENERATION_ATTEMPTS; attempt += 1) {
    const spread = spreadBridgesIslands(identity.conditions, random);
    const { refinementSteps } = identity.conditions;
    const layout =
      spread === null || refinementSteps === 0
        ? spread
        : refineBridgesLayout(spread, refinementSteps, random);
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
