import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { restoreMinesweeperProblemWithoutAnalysis } from "@/games/minesweeper/problem/generator";
import type { MinesweeperIdentifiedProblem } from "@/games/minesweeper/problem/problem";
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
): MinesweeperIdentifiedProblem {
  return restoreMinesweeperProblemWithoutAnalysis(
    toMinesweeperPoolIdentity(difficulty, entry),
  );
}

export function selectMinesweeperProblemForDifficulty(
  difficulty: MinesweeperDifficulty,
  seed: ProblemSeed,
): MinesweeperIdentifiedProblem {
  const entry = selectProblemPoolEntry(
    listMinesweeperPoolEntries(difficulty),
    seed,
    `level ${difficulty} minesweeper`,
  );
  return restorePoolEntry(difficulty, entry);
}

export function selectMinesweeperProblemById(
  difficulty: MinesweeperDifficulty,
  problemId: string,
): MinesweeperIdentifiedProblem | null {
  const entry = findMinesweeperPoolEntryByProblemId(difficulty, problemId);
  return entry ? restorePoolEntry(difficulty, entry) : null;
}

export function canSelectMinesweeperProblemById(
  difficulty: MinesweeperDifficulty,
  problemId: string,
): boolean {
  return findMinesweeperPoolEntryByProblemId(difficulty, problemId) !== null;
}
