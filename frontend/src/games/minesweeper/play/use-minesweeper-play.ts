import { useState } from "react";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { useMinesweeperProblemPlay } from "@/games/minesweeper/play/use-minesweeper-problem-play";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import { createProblemSeed } from "@/games/problem-seed";

export function useMinesweeperPlay(difficulty: MinesweeperDifficulty) {
  const [problem] = useState(
    () =>
      selectMinesweeperProblemForDifficulty(difficulty, createProblemSeed())
        .problem,
  );
  return useMinesweeperProblemPlay(problem);
}
