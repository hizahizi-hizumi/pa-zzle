import type { MinesweeperDifficulty } from "../difficulty";
import { selectMinesweeperProblemForDifficulty } from "../problem-selection";
import { useMinesweeperProblemPlay } from "./use-minesweeper-problem-play";

export function useMinesweeperPlay(difficulty: MinesweeperDifficulty) {
  return useMinesweeperProblemPlay(
    selectMinesweeperProblemForDifficulty(difficulty),
  );
}
