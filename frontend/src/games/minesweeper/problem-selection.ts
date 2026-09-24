import type { MinesweeperDifficulty } from "./difficulty";
import type { MinesweeperProblem } from "./problem/problem";
import { minesweeperReviewProblem } from "./problem/review-problem";

// 難易度ごとの問題が定まるまで、全難易度で同じ固定問題を使う。
export function selectMinesweeperProblemForDifficulty(
  _difficulty: MinesweeperDifficulty,
): MinesweeperProblem {
  return minesweeperReviewProblem;
}
