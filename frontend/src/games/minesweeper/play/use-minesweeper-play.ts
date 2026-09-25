import { useState } from "react";

import { createProblemSeed } from "@/games/problem-seed";
import type { MinesweeperDifficulty } from "../difficulty";
import { selectMinesweeperProblemForDifficulty } from "../problem-selection";
import { useMinesweeperProblemPlay } from "./use-minesweeper-problem-play";

export function useMinesweeperPlay(difficulty: MinesweeperDifficulty) {
  const [problem] = useState(
    () =>
      selectMinesweeperProblemForDifficulty(difficulty, createProblemSeed())
        .problem,
  );
  return useMinesweeperProblemPlay(problem);
}
