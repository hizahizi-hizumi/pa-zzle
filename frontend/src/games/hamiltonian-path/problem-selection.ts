import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import { generateHamiltonianPathProblem } from "@/games/hamiltonian-path/problem/generator";
import {
  createHamiltonianPathProblemIdentity,
  type HamiltonianPathGenerationConditions,
  type HamiltonianPathIdentifiedProblem,
  type HamiltonianPathProblemIdentity,
} from "@/games/hamiltonian-path/problem/problem";
import { createProblemId } from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

/**
 * 問題集ができるまでの仮の生成条件。難易度分析をしていないので、レベルの難しさは保証しない。
 * 値は組み合わせモデルの規模の範囲（盤面サイズ 5〜8・壁率）から1つずつ選んだもの。
 */
const provisionalConditionsByDifficulty = {
  "1": { size: 5, wallRatio: 0.15 },
  "2": { size: 6, wallRatio: 0.15 },
  "3": { size: 6, wallRatio: 0 },
  "4": { size: 7, wallRatio: 0 },
  "5": { size: 8, wallRatio: 0 },
} as const satisfies Record<
  HamiltonianPathDifficulty,
  HamiltonianPathGenerationConditions
>;

/**
 * 難易度ごとに出す仮の候補の数。候補番号 0 からこの数までの identity を、問題集の代わりの固定の一覧にする。
 * 一覧が決まっているので、URL の問題 ID から問題を引ける。
 */
const PROVISIONAL_CANDIDATE_COUNT = 30;

function listProvisionalIdentities(
  difficulty: HamiltonianPathDifficulty,
): HamiltonianPathProblemIdentity[] {
  const { size, wallRatio } = provisionalConditionsByDifficulty[difficulty];
  return Array.from(
    { length: PROVISIONAL_CANDIDATE_COUNT },
    (_, candidateIndex) =>
      createHamiltonianPathProblemIdentity(size, wallRatio, candidateIndex),
  );
}

/** 生成結果から、プレイに渡さない解と生成の記録を除く。 */
function generateIdentifiedProblem(
  identity: HamiltonianPathProblemIdentity,
): HamiltonianPathIdentifiedProblem {
  const { problem } = generateHamiltonianPathProblem(identity);
  return { problem, identity };
}

/**
 * 難易度の仮の候補の一覧から seed で1つを選び、その場で問題を作る。
 * 問題集から出題できるようになったら、問題集からの選択に置き換える。
 */
export function selectHamiltonianPathProblemForDifficulty(
  difficulty: HamiltonianPathDifficulty,
  seed: ProblemSeed,
): HamiltonianPathIdentifiedProblem {
  const identity = selectProblemPoolEntry(
    listProvisionalIdentities(difficulty),
    seed,
    `level ${difficulty} Hamiltonian path`,
  );
  return generateIdentifiedProblem(identity);
}

/** 難易度の仮の候補の一覧から問題 ID で1問を引いて作る。引けない ID には `null` を返す。 */
export function selectHamiltonianPathProblemById(
  difficulty: HamiltonianPathDifficulty,
  problemId: string,
): HamiltonianPathIdentifiedProblem | null {
  const identity = listProvisionalIdentities(difficulty).find(
    (candidate) => createProblemId(candidate) === problemId,
  );
  return identity ? generateIdentifiedProblem(identity) : null;
}

export const _private = {
  listProvisionalIdentities,
};
