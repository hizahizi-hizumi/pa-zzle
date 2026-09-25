import {
  assertMinesweeperProblem,
  type MinesweeperProblem,
} from "../problem/problem";
import { getMinesweeperCellCount } from "../puzzle/board";
import {
  getAdjacentMinesweeperMineCount,
  isMinesweeperCleared,
  isMinesweeperMine,
} from "../puzzle/rules";
import type { MinesweeperPuzzleState } from "../puzzle/state";
import {
  chordMinesweeperCell,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
} from "../puzzle/transitions";

export type MinesweeperSessionStatus = "playing" | "cleared";

export type MinesweeperVisibleCell =
  | { state: "hidden" }
  | { state: "flagged" }
  | { state: "revealed"; adjacentMineCount: number }
  | { state: "mine" }
  | { state: "steppedMine" };

export type MinesweeperSession = {
  status: MinesweeperSessionStatus;
  problem: MinesweeperProblem;
  puzzleState: MinesweeperPuzzleState;
  startedAt: number;
  finishedAt: number | null;
  // 踏んだ地雷の数。1回の操作で複数の地雷を踏んだ場合は、その数だけ数える。
  mistakeCount: number;
};

function getSessionStatus(
  problem: MinesweeperProblem,
  puzzleState: MinesweeperPuzzleState,
): MinesweeperSessionStatus {
  return isMinesweeperCleared(problem.board, puzzleState)
    ? "cleared"
    : "playing";
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

  const steppedMineCount =
    puzzleState.steppedMineCellIndices.length -
    session.puzzleState.steppedMineCellIndices.length;

  return {
    ...session,
    status,
    puzzleState,
    finishedAt: status === "playing" ? null : operatedAt,
    mistakeCount: session.mistakeCount + steppedMineCount,
  };
}

function getVisibleCell(
  session: MinesweeperSession,
  cellIndex: number,
): MinesweeperVisibleCell {
  const { puzzleState } = session;
  if (puzzleState.steppedMineCellIndices.includes(cellIndex)) {
    return { state: "steppedMine" };
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
  if (
    session.status === "cleared" &&
    isMinesweeperMine(session.problem.board, cellIndex)
  ) {
    return { state: "mine" };
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
    steppedMineCellIndices: [],
  };

  const status = getSessionStatus(problem, puzzleState);

  return {
    status,
    problem,
    puzzleState,
    startedAt,
    finishedAt: status === "playing" ? null : startedAt,
    mistakeCount: 0,
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

export function getMinesweeperSessionElapsedMs(
  session: MinesweeperSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getMinesweeperSessionVisibleCells(
  session: MinesweeperSession,
): MinesweeperVisibleCell[] {
  return Array.from(
    { length: getMinesweeperCellCount(session.problem.board) },
    function getVisibleCellAtIndex(_, cellIndex) {
      return getVisibleCell(session, cellIndex);
    },
  );
}
