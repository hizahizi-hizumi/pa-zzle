import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import {
  MINESWEEPER_GENERATOR_VERSION,
  type MinesweeperProblemIdentity,
} from "@/games/minesweeper/problem/problem";

/**
 * 難易度ごとの盤面範囲と推論の条件を人が遊んで比べるための問題群。
 * `scripts/find-minesweeper-difficulty-review-problems.ts` が各難易度の盤面範囲から決定的に探した結果で、
 * 難易度ごとに盤面サイズの最小・中間・最大を1問ずつ並べる。
 */
export type MinesweeperDifficultyReviewProblem = {
  difficulty: MinesweeperDifficulty;
  identity: MinesweeperProblemIdentity;
};

function reviewProblem(
  difficulty: MinesweeperDifficulty,
  seed: string,
  rows: number,
  columns: number,
  mineCount: number,
): MinesweeperDifficultyReviewProblem {
  return {
    difficulty,
    identity: {
      generatorVersion: MINESWEEPER_GENERATOR_VERSION,
      seed,
      conditions: { rows, columns, mineCount, startCellPlacement: "random" },
      generationAttempt: 1,
    },
  };
}

export const minesweeperDifficultyReviewProblems: readonly MinesweeperDifficultyReviewProblem[] =
  [
    reviewProblem("1", "ms-review-1-9x9-1", 9, 9, 10),
    reviewProblem("1", "ms-review-1-10x9-1", 10, 9, 11),
    reviewProblem("1", "ms-review-1-10x10-0", 10, 10, 11),
    reviewProblem("2", "ms-review-2-9x9-3", 9, 9, 12),
    reviewProblem("2", "ms-review-2-10x10-2", 10, 10, 15),
    reviewProblem("2", "ms-review-2-12x10-0", 12, 10, 16),
    reviewProblem("3", "ms-review-3-10x10-17", 10, 10, 17),
    reviewProblem("3", "ms-review-3-12x10-17", 12, 10, 20),
    reviewProblem("3", "ms-review-3-14x10-24", 14, 10, 21),
    reviewProblem("4", "ms-review-4-12x10-30", 12, 10, 20),
    reviewProblem("4", "ms-review-4-14x10-0", 14, 10, 23),
    reviewProblem("4", "ms-review-4-16x12-25", 16, 12, 32),
    reviewProblem("5", "ms-review-5-14x10-16", 14, 10, 27),
    reviewProblem("5", "ms-review-5-16x10-295", 16, 10, 32),
    reviewProblem("5", "ms-review-5-16x12-37", 16, 12, 36),
  ];
