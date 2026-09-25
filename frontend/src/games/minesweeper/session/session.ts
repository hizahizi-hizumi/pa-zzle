import {
  assertMinesweeperProblem,
  type MinesweeperProblem,
} from "@/games/minesweeper/problem/problem";
import { getMinesweeperCellCount } from "@/games/minesweeper/puzzle/board";
import {
  getAdjacentMinesweeperMineCount,
  isMinesweeperCleared,
} from "@/games/minesweeper/puzzle/rules";
import type { MinesweeperPuzzleState } from "@/games/minesweeper/puzzle/state";
import {
  chordMinesweeperCell,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
} from "@/games/minesweeper/puzzle/transitions";

export type MinesweeperSessionStatus = "playing" | "cleared" | "failed";

export type MinesweeperVisibleCell =
  | { state: "hidden" }
  | { state: "flagged" }
  | { state: "revealed"; adjacentMineCount: number }
  | { state: "exploded" };

export type MinesweeperSession = {
  status: MinesweeperSessionStatus;
  problem: MinesweeperProblem;
  puzzleState: MinesweeperPuzzleState;
  startedAt: number;
  finishedAt: number | null;
};

function getSessionStatus(
  problem: MinesweeperProblem,
  puzzleState: MinesweeperPuzzleState,
): MinesweeperSessionStatus {
  if (puzzleState.explodedCellIndex !== null) {
    return "failed";
  }

  if (isMinesweeperCleared(problem.board, puzzleState)) {
    return "cleared";
  }

  return "playing";
}

function applyPuzzleState(
  session: MinesweeperSession,
  puzzleState: MinesweeperPuzzleState,
  operatedAt: number,
): MinesweeperSession {
  if (puzzleState === session.puzzleState) {
    return session;
  }

  const status = getSessionStatus(session.problem, puzzleState);

  return {
    ...session,
    status,
    puzzleState,
    finishedAt: status === "playing" ? null : operatedAt,
  };
}

function getVisibleCell(
  session: MinesweeperSession,
  cellIndex: number,
): MinesweeperVisibleCell {
  const { puzzleState } = session;
  if (puzzleState.explodedCellIndex === cellIndex) {
    return { state: "exploded" };
  }
  if (puzzleState.flaggedCellIndices.includes(cellIndex)) {
    return { state: "flagged" };
  }
  if (puzzleState.revealedCellIndices.includes(cellIndex)) {
    return {
      state: "revealed",
      adjacentMineCount: getAdjacentMinesweeperMineCount(
        session.problem.board,
        cellIndex,
      ),
    };
  }
  return { state: "hidden" };
}

export function createMinesweeperSession(
  problem: MinesweeperProblem,
  startedAt: number,
): MinesweeperSession {
  assertMinesweeperProblem(problem);

  const puzzleState: MinesweeperPuzzleState = {
    revealedCellIndices: [...problem.initialRevealedCellIndices].sort(
      (left, right) => left - right,
    ),
    flaggedCellIndices: [],
    explodedCellIndex: null,
  };

  const status = getSessionStatus(problem, puzzleState);

  return {
    status,
    problem,
    puzzleState,
    startedAt,
    finishedAt: status === "playing" ? null : startedAt,
  };
}

export function revealMinesweeperSessionCell(
  session: MinesweeperSession,
  cellIndex: number,
  revealedAt: number,
): MinesweeperSession {
  if (session.status !== "playing") {
    return session;
  }

  return applyPuzzleState(
    session,
    revealMinesweeperCell(
      session.problem.board,
      session.puzzleState,
      cellIndex,
    ),
    revealedAt,
  );
}

export function toggleMinesweeperSessionFlag(
  session: MinesweeperSession,
  cellIndex: number,
): MinesweeperSession {
  if (session.status !== "playing") {
    return session;
  }

  return applyPuzzleState(
    session,
    toggleMinesweeperFlag(
      session.problem.board,
      session.puzzleState,
      cellIndex,
    ),
    session.startedAt,
  );
}

export function chordMinesweeperSessionCell(
  session: MinesweeperSession,
  cellIndex: number,
  chordedAt: number,
): MinesweeperSession {
  if (session.status !== "playing") {
    return session;
  }

  return applyPuzzleState(
    session,
    chordMinesweeperCell(session.problem.board, session.puzzleState, cellIndex),
    chordedAt,
  );
}

export function replayMinesweeperSession(
  session: MinesweeperSession,
  startedAt: number,
): MinesweeperSession {
  return createMinesweeperSession(session.problem, startedAt);
}

export function getMinesweeperSessionVisibleCells(
  session: MinesweeperSession,
): MinesweeperVisibleCell[] {
  return Array.from(
    { length: getMinesweeperCellCount(session.problem.board) },
    (_, cellIndex) => getVisibleCell(session, cellIndex),
  );
}
