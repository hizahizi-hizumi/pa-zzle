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
 * 問題集ができるまでの仮の候補。生成条件と、その条件の候補番号のうち、難易度分析でそのレベルに分類された番号を
 * 小さい順に20個並べた固定の一覧。一覧が決まっているので、URL の問題 ID から問題を引ける。
 * 生成条件は、組み合わせ定義（`hamiltonianPathLevelCombinations`）の盤面サイズの範囲のうち、分析スクリプトの問題集合で
 * そのレベルに分類された割合が高いもの（レベル1: 87%、2: 17%、3: 26%、4: 25%、5: 7%）。
 */
const provisionalCandidatesByDifficulty = {
  "1": {
    conditions: { size: 5, wallRatio: 0 },
    candidateIndices: [
      0, 1, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23,
    ],
  },
  "2": {
    conditions: { size: 6, wallRatio: 0 },
    candidateIndices: [
      5, 6, 34, 39, 41, 43, 44, 61, 86, 91, 99, 100, 106, 114, 116, 126, 136,
      137, 149, 153,
    ],
  },
  "3": {
    conditions: { size: 7, wallRatio: 0 },
    candidateIndices: [
      2, 4, 15, 17, 25, 28, 33, 35, 36, 39, 43, 46, 51, 53, 58, 59, 60, 61, 63,
      64,
    ],
  },
  "4": {
    conditions: { size: 8, wallRatio: 0 },
    candidateIndices: [
      4, 8, 9, 14, 15, 19, 21, 30, 41, 44, 46, 47, 50, 57, 58, 64, 65, 74, 81,
      83,
    ],
  },
  "5": {
    conditions: { size: 8, wallRatio: 0 },
    candidateIndices: [
      16, 18, 22, 29, 31, 34, 43, 45, 51, 75, 119, 136, 153, 162, 187, 196, 215,
      243, 256, 265,
    ],
  },
} as const satisfies Record<
  HamiltonianPathDifficulty,
  {
    conditions: HamiltonianPathGenerationConditions;
    candidateIndices: readonly number[];
  }
>;

function listProvisionalIdentities(
  difficulty: HamiltonianPathDifficulty,
): HamiltonianPathProblemIdentity[] {
  const { conditions, candidateIndices } =
    provisionalCandidatesByDifficulty[difficulty];
  return candidateIndices.map((candidateIndex) =>
    createHamiltonianPathProblemIdentity(
      conditions.size,
      conditions.wallRatio,
      candidateIndex,
    ),
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
