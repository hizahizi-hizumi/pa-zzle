import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import {
  type MinesweeperRestoredProblem,
  restoreMinesweeperProblemWithoutAnalysis,
} from "@/games/minesweeper/problem/generator";
import {
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";
import { hashProblemSeed, type ProblemSeed } from "@/games/problem-seed";

/**
 * 難易度の問題集から seed で1問を選んで復元する。
 * 問題集は生成時に難易度を判定済みのため、プレイ時には難易度分析を走らせない。
 */
export function selectMinesweeperProblemForDifficulty(
  difficulty: MinesweeperDifficulty,
  seed: ProblemSeed,
): MinesweeperRestoredProblem {
  const entries = listMinesweeperPoolEntries(difficulty);
  const entry = entries[hashProblemSeed(seed) % entries.length];
  if (!entry) {
    throw new Error(`No level ${difficulty} minesweeper problem is available`);
  }

  return restoreMinesweeperProblemWithoutAnalysis(
    toMinesweeperPoolIdentity(difficulty, entry),
  );
}
