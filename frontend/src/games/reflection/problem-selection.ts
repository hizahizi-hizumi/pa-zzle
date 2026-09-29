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
 * 問題集ができるまでの仮の生成条件。難易度分析をしていないので、レベルの難しさは保証しない。
 * 値は組み合わせモデルの規模の範囲（盤面サイズ・ピース数）から1つずつ選んだもの。
 */
const provisionalConditionsByDifficulty = {
  "1": { size: 5, pieceCount: 3 },
  "2": { size: 5, pieceCount: 4 },
  "3": { size: 6, pieceCount: 6 },
  "4": { size: 6, pieceCount: 8 },
  "5": { size: 7, pieceCount: 10 },
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
