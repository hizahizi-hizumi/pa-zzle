import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import {
  type MinesweeperRestoredProblem,
  restoreMinesweeperProblemWithoutAnalysis,
} from "@/games/minesweeper/problem/generator";
import {
  findMinesweeperPoolEntryByProblemId,
  listMinesweeperPoolEntries,
  type MinesweeperProblemPoolEntry,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemPoolEntry } from "@/games/problem-selection";

// 問題集は生成時に難易度を判定済みのため、プレイ時には難易度分析を走らせない。
function restorePoolEntry(
  difficulty: MinesweeperDifficulty,
  entry: MinesweeperProblemPoolEntry,
): MinesweeperRestoredProblem {
  return restoreMinesweeperProblemWithoutAnalysis(
    toMinesweeperPoolIdentity(difficulty, entry),
  );
}

/** 難易度の問題集から seed で1問を選んで復元する。 */
export function selectMinesweeperProblemForDifficulty(
  difficulty: MinesweeperDifficulty,
  seed: ProblemSeed,
): MinesweeperRestoredProblem {
  const entry = selectProblemPoolEntry(
    listMinesweeperPoolEntries(difficulty),
    seed,
    `level ${difficulty} minesweeper`,
  );
  return restorePoolEntry(difficulty, entry);
}

/** 難易度の問題集から問題 ID で1問を引いて復元する。引けない ID には `null` を返す。 */
export function selectMinesweeperProblemById(
  difficulty: MinesweeperDifficulty,
  problemId: string,
): MinesweeperRestoredProblem | null {
  const entry = findMinesweeperPoolEntryByProblemId(difficulty, problemId);
  return entry ? restorePoolEntry(difficulty, entry) : null;
}

/** 難易度の問題集から問題 ID で1問を引けるかを、問題を復元せずに確かめる。 */
export function canSelectMinesweeperProblemById(
  difficulty: MinesweeperDifficulty,
  problemId: string,
): boolean {
  return findMinesweeperPoolEntryByProblemId(difficulty, problemId) !== null;
}
