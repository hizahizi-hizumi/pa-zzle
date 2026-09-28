import type { ProblemSeed } from "@/games/problem-seed";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import {
  generateReflectionProblem,
  type ReflectionGeneratedProblem,
} from "@/games/reflection/problem/generator";
import {
  REFLECTION_GENERATOR_VERSION,
  type ReflectionGenerationConditions,
} from "@/games/reflection/problem/problem";

/**
 * 問題集ができるまでの仮の生成条件。生成した問題を分析しないので、レベルの難しさは保証しない。
 * 値は、組み合わせ定義（`reflectionLevelCombinations`）の規模の範囲のうち、分析スクリプトの問題集合でそのレベルに分類された割合が
 * 最も高い盤面サイズとピース数（レベル1: 45%、2: 20%、3: 73%、4: 55%、5: 70%）。
 */
const provisionalConditionsByDifficulty = {
  "1": { size: 5, pieceCount: 2 },
  "2": { size: 6, pieceCount: 2 },
  "3": { size: 5, pieceCount: 4 },
  "4": { size: 7, pieceCount: 7 },
  "5": { size: 7, pieceCount: 11 },
} as const satisfies Record<
  ReflectionDifficulty,
  ReflectionGenerationConditions
>;

/**
 * 難易度の仮の生成条件で、seed から問題を作る。
 * 問題集から出題できるようになったら、問題集からの選択に置き換える。
 */
export function selectReflectionProblemForDifficulty(
  difficulty: ReflectionDifficulty,
  seed: ProblemSeed,
): ReflectionGeneratedProblem {
  return generateReflectionProblem({
    generatorVersion: REFLECTION_GENERATOR_VERSION,
    seed,
    conditions: { ...provisionalConditionsByDifficulty[difficulty] },
  });
}
