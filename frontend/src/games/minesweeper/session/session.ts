import {
  assertMinesweeperProblem,
  type MinesweeperProblem,
} from "@/games/minesweeper/problem/problem";
import {
  getMinesweeperCellCount,
  type MinesweeperBoard,
} from "@/games/minesweeper/puzzle/board";
import {
  getAdjacentMinesweeperMineCount,
  isMinesweeperCleared,
  isMinesweeperMine,
} from "@/games/minesweeper/puzzle/rules";
import type { MinesweeperPuzzleState } from "@/games/minesweeper/puzzle/state";
import {
  chordMinesweeperCell,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
} from "@/games/minesweeper/puzzle/transitions";
import {
  type GameSession,
  type GameSessionStatus,
  getClearedSessionElapsedMs,
} from "@/games/session";

export type MinesweeperVisibleCell =
  | { state: "hidden" }
  | { state: "flagged" }
  | { state: "revealed"; adjacentMineCount: number }
  | { state: "mine" }
  | { state: "steppedMine" };

export type MinesweeperSession = GameSession<
  MinesweeperProblem,
  MinesweeperPuzzleState
> & {
  // 踏んだ地雷の数。1回の操作で複数の地雷を踏んだ場合は、その数だけ数える。
  mistakeCount: number;
};

/** クリアしたプレイで記録する事実。評価は保存した事実から導出するため、評価値は持たない。 */
export type MinesweeperSessionResult = {
  elapsedMs: number;
  mistakeCount: number;
};

function getSessionStatus(
  problem: MinesweeperProblem,
  puzzleState: MinesweeperPuzzleState,
): GameSessionStatus {
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
  board: MinesweeperBoard,
  puzzleState: MinesweeperPuzzleState,
  cleared: boolean,
  cellIndex: number,
): MinesweeperVisibleCell {
  if (puzzleState.steppedMineCellIndices.includes(cellIndex)) {
    return { state: "steppedMine" };
  }
  if (puzzleState.flaggedCellIndices.includes(cellIndex)) {
    return { state: "flagged" };
  }
  if (puzzleState.revealedCellIndices.includes(cellIndex)) {
    return {
      state: "revealed",
      adjacentMineCount: getAdjacentMinesweeperMineCount(board, cellIndex),
    };
  }
  if (cleared && isMinesweeperMine(board, cellIndex)) {
    return { state: "mine" };
  }
  return { state: "hidden" };
}

/** 盤面の見え方。地雷の配置は、解き終えた盤面でだけ明かす。 */
export function getMinesweeperVisibleCells(
  board: MinesweeperBoard,
  puzzleState: MinesweeperPuzzleState,
  cleared: boolean,
): MinesweeperVisibleCell[] {
  return Array.from(
    { length: getMinesweeperCellCount(board) },
    function getVisibleCellAtIndex(_, cellIndex) {
      return getVisibleCell(board, puzzleState, cleared, cellIndex);
    },
  );
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

export function getMinesweeperSessionResult(
  session: MinesweeperSession,
): MinesweeperSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return { elapsedMs, mistakeCount: session.mistakeCount };
}

export function getMinesweeperSessionVisibleCells(
  session: MinesweeperSession,
): MinesweeperVisibleCell[] {
  return getMinesweeperVisibleCells(
    session.problem.board,
    session.puzzleState,
    session.status === "cleared",
  );
}
