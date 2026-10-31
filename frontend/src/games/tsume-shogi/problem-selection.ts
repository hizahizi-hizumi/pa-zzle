import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type {
  TsumeShogiIdentifiedProblem,
  TsumeShogiProblemIdentity,
} from "@/games/tsume-shogi/problem/problem";
import { listTsumeShogiProvisionalProblems } from "@/games/tsume-shogi/problem/provisional-problems";

/**
 * 難易度の問題を seed で選ぶ。問題集ができるまでは、どの難易度でも仮の問題から選ぶ（難易度を分析していない）。
 * 問題集から出題できるようになったら、難易度ごとの問題集からの選択に置き換える。
 */
export function selectTsumeShogiProblemForDifficulty(
  _difficulty: TsumeShogiDifficulty,
  seed: ProblemSeed,
): TsumeShogiIdentifiedProblem {
  return selectProblemPoolEntry(
    listTsumeShogiProvisionalProblems(),
    seed,
    "provisional Tsume Shogi",
  );
}

/** identity が出題できる問題のものなら、その問題を返す。無ければ `null`。 */
export function restoreTsumeShogiProblem(
  identity: TsumeShogiProblemIdentity,
): TsumeShogiIdentifiedProblem | null {
  return (
    listTsumeShogiProvisionalProblems().find(
      (candidate) =>
        candidate.identity.generatorVersion === identity.generatorVersion &&
        candidate.identity.seed === identity.seed &&
        candidate.identity.conditions.plies === identity.conditions.plies,
    ) ?? null
  );
}
