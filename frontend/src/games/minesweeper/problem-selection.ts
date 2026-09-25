import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { minesweeperReviewProblem } from "@/games/minesweeper/problem/review-problem";

// 難易度ごとの問題が定まるまで、全難易度で同じ固定問題を使う。
export function selectMinesweeperProblemForDifficulty(
  _difficulty: MinesweeperDifficulty,
): MinesweeperProblem {
  return minesweeperReviewProblem;
}
