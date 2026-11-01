import {
  createBoardSizeFeature,
  createProblemCountFeature,
  type ProblemFeature,
} from "@/components/problem-features";
import type { MinesweeperProblemFeatures } from "@/games/minesweeper/problem/problem-pool";

export function formatMinesweeperProblemFeatures({
  rows,
  columns,
  mineCount,
}: MinesweeperProblemFeatures): ProblemFeature[] {
  return [
    createBoardSizeFeature("盤面", { rows, columns }),
    createProblemCountFeature("地雷", mineCount, "個"),
  ];
}
