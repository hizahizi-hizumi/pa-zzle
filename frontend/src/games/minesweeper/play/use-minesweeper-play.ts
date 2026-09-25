import { useCallback, useState } from "react";

import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import {
  chordMinesweeperSessionCell,
  createMinesweeperSession,
  getMinesweeperSessionVisibleCells,
  replayMinesweeperSession,
  revealMinesweeperSessionCell,
  toggleMinesweeperSessionFlag,
} from "@/games/minesweeper/session/session";

export function useMinesweeperPlay(difficulty: MinesweeperDifficulty) {
  const [session, setSession] = useState(() =>
    createMinesweeperSession(
      selectMinesweeperProblemForDifficulty(difficulty),
      Date.now(),
    ),
  );

  const revealCell = useCallback((cellIndex: number) => {
    const revealedAt = Date.now();
    setSession((current) =>
      revealMinesweeperSessionCell(current, cellIndex, revealedAt),
    );
  }, []);

  const toggleFlag = useCallback((cellIndex: number) => {
    setSession((current) => toggleMinesweeperSessionFlag(current, cellIndex));
  }, []);

  const chordCell = useCallback((cellIndex: number) => {
    const chordedAt = Date.now();
    setSession((current) =>
      chordMinesweeperSessionCell(current, cellIndex, chordedAt),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setSession((current) => replayMinesweeperSession(current, startedAt));
  }, []);

  return {
    rows: session.problem.board.rows,
    columns: session.problem.board.columns,
    mineCount: session.problem.board.mineCellIndices.length,
    flagCount: session.puzzleState.flaggedCellIndices.length,
    visibleCells: getMinesweeperSessionVisibleCells(session),
    status: session.status,
    revealCell,
    toggleFlag,
    chordCell,
    replay,
  };
}
