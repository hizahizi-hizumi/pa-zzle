import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { useMinesweeperProblemPlay } from "@/games/minesweeper/play/use-minesweeper-problem-play";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";

export function useMinesweeperPlay(difficulty: MinesweeperDifficulty) {
  return useMinesweeperProblemPlay(
    selectMinesweeperProblemForDifficulty(difficulty),
  );
}
