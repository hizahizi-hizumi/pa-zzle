import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { useMinesweeperProblemPlay } from "@/games/minesweeper/play/use-minesweeper-problem-play";

export function useMinesweeperPlay(difficulty: MinesweeperDifficulty) {
  return useMinesweeperProblemPlay(
    selectMinesweeperProblemForDifficulty(difficulty),
  );
}
