import { useCallback, useMemo, useRef, useState } from "react";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import {
  countMinesweeperMinimumOpenCount,
  type MinesweeperIdentifiedProblem,
  type MinesweeperProblemIdentity,
} from "@/games/minesweeper/problem/problem";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import type { MinesweeperPuzzleState } from "@/games/minesweeper/puzzle/state";
import {
  calculateMinesweeperPlayScore,
  calculateMinesweeperSpeedScoreRule,
  type MinesweeperPlayScore,
} from "@/games/minesweeper/score";
import {
  chordMinesweeperSessionCell,
  createMinesweeperSession,
  getMinesweeperSessionResult,
  getMinesweeperSessionVisibleCells,
  type MinesweeperSession,
  type MinesweeperSessionResult,
  type MinesweeperVisibleCell,
  revealMinesweeperSessionCell,
  toggleMinesweeperSessionFlag,
} from "@/games/minesweeper/session/session";
import {
  applyPlaySession,
  completePlayClearAnimation,
  type GamePlay,
  type GameProgress,
  getProgressAfterSessionChange,
  startPlaySession,
  useSessionElapsedMs,
} from "@/games/play";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";

/**
 * 盤面が変わった操作の知らせ。`cellIndex` は押したマス。
 * - `cells-opened`: 安全なマスを開いた。数字マスを押して周りをまとめて開いたときも含む。`openedCellIndices` は連鎖して開いたマスも含む。
 * - `mine-stepped`: 地雷を踏んだ。同じ操作で安全なマスも開いたときは `openedCellIndices` に含める。
 */
export type MinesweeperOperation =
  | {
      id: number;
      type: "cells-opened";
      cellIndex: number;
      openedCellIndices: readonly number[];
    }
  | {
      id: number;
      type: "mine-stepped";
      cellIndex: number;
      steppedMineCount: number;
      openedCellIndices: readonly number[];
    }
  | { id: number; type: "flag-placed" | "flag-removed"; cellIndex: number };

export type MinesweeperResultProblemFacts = {
  mineCount: number;
  // 問題の初期開示状態から安全なマスをすべて開くのに要る、開く操作の最小回数。速さの基準時間に使う。
  minimumOpenCount: number;
};

export type MinesweeperResult = MinesweeperSessionResult &
  MinesweeperResultProblemFacts & {
    speedRule: SpeedScoreRule;
    timeDeltaMs: number;
    score: MinesweeperPlayScore;
  };

/** プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createMinesweeperResult(
  sessionResult: MinesweeperSessionResult,
  problemFacts: MinesweeperResultProblemFacts,
): MinesweeperResult {
  const facts = { ...sessionResult, ...problemFacts };
  const speedRule = calculateMinesweeperSpeedScoreRule(problemFacts);
  return {
    ...facts,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateMinesweeperPlayScore(facts),
  };
}

export type MinesweeperPlay = GamePlay<
  MinesweeperDifficulty,
  MinesweeperProblemIdentity,
  MinesweeperSession,
  MinesweeperResult
> & {
  rows: number;
  columns: number;
  mineCount: number;
  flagCount: number;
  mistakeCount: number;
  visibleCells: MinesweeperVisibleCell[];
  operation: MinesweeperOperation | null;
  revealCell: (cellIndex: number) => void;
  toggleFlag: (cellIndex: number) => void;
  chordCell: (cellIndex: number) => void;
};

type MinesweeperPlayState = {
  problemIdentity: MinesweeperProblemIdentity;
  problemFacts: MinesweeperResultProblemFacts;
  session: MinesweeperSession;
  progress: GameProgress;
  operation: MinesweeperOperation | null;
};

function createPlayState(
  { problem, identity }: MinesweeperIdentifiedProblem,
  startedAt: number,
): MinesweeperPlayState {
  const session = createMinesweeperSession(problem, startedAt);
  return {
    problemIdentity: identity,
    problemFacts: {
      mineCount: problem.board.mineCellIndices.length,
      minimumOpenCount: countMinesweeperMinimumOpenCount(problem),
    },
    session,
    progress: getProgressAfterSessionChange("playing", session.status),
    operation: null,
  };
}

export function createMinesweeperOpeningOperation(
  id: number,
  cellIndex: number,
  previous: MinesweeperPuzzleState,
  next: MinesweeperPuzzleState,
): MinesweeperOperation {
  const previouslyRevealed = new Set(previous.revealedCellIndices);
  const openedCellIndices = next.revealedCellIndices.filter(
    (revealedCellIndex) => !previouslyRevealed.has(revealedCellIndex),
  );
  const steppedMineCount =
    next.steppedMineCellIndices.length - previous.steppedMineCellIndices.length;
  return steppedMineCount > 0
    ? {
        id,
        type: "mine-stepped",
        cellIndex,
        steppedMineCount,
        openedCellIndices,
      }
    : { id, type: "cells-opened", cellIndex, openedCellIndices };
}

export function createMinesweeperFlagOperation(
  id: number,
  cellIndex: number,
  next: MinesweeperPuzzleState,
): MinesweeperOperation {
  return {
    id,
    type: next.flaggedCellIndices.includes(cellIndex)
      ? "flag-placed"
      : "flag-removed",
    cellIndex,
  };
}

function applyOperation(
  current: MinesweeperPlayState,
  session: MinesweeperSession,
  createOperation: (
    previous: MinesweeperPuzzleState,
    next: MinesweeperPuzzleState,
  ) => MinesweeperOperation,
): MinesweeperPlayState {
  const next = applyPlaySession(current, session);
  return next === current
    ? current
    : {
        ...next,
        operation: createOperation(
          current.session.puzzleState,
          session.puzzleState,
        ),
      };
}

function selectProblem(
  difficulty: MinesweeperDifficulty,
  avoidedProblemId: ProblemId | undefined,
): MinesweeperIdentifiedProblem {
  return selectProblemAvoiding(
    (seed) => selectMinesweeperProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

export function useMinesweeperPlay(
  difficulty: MinesweeperDifficulty,
  initialProblem?: MinesweeperIdentifiedProblem,
  avoidedProblemId?: ProblemId,
): MinesweeperPlay {
  const [play, setPlay] = useState(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, problemIdentity, problemFacts } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextOperationId = useRef(0);

  const revealCell = useCallback((cellIndex: number) => {
    const revealedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      applyOperation(
        current,
        revealMinesweeperSessionCell(current.session, cellIndex, revealedAt),
        (previous, next) =>
          createMinesweeperOpeningOperation(
            operationId,
            cellIndex,
            previous,
            next,
          ),
      ),
    );
  }, []);

  const toggleFlag = useCallback((cellIndex: number) => {
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      applyOperation(
        current,
        toggleMinesweeperSessionFlag(current.session, cellIndex),
        (_previous, next) =>
          createMinesweeperFlagOperation(operationId, cellIndex, next),
      ),
    );
  }, []);

  const chordCell = useCallback((cellIndex: number) => {
    const chordedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      applyOperation(
        current,
        chordMinesweeperSessionCell(current.session, cellIndex, chordedAt),
        (previous, next) =>
          createMinesweeperOpeningOperation(
            operationId,
            cellIndex,
            previous,
            next,
          ),
      ),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createMinesweeperSession(current.session.problem, startedAt),
      ),
      operation: null,
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    setPlay(
      createPlayState(
        selectProblem(difficulty, createProblemId(problemIdentity)),
        Date.now(),
      ),
    );
  }, [difficulty, problemIdentity]);

  const completeClearAnimation = useCallback(() => {
    setPlay(completePlayClearAnimation);
  }, []);

  const result = useMemo(() => {
    const sessionResult = getMinesweeperSessionResult(session);
    return sessionResult
      ? createMinesweeperResult(sessionResult, problemFacts)
      : null;
  }, [problemFacts, session]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress: play.progress,
    startedAt: session.startedAt,
    completedAt: session.clearedAt,
    elapsedMs,
    result,
    rows: session.problem.board.rows,
    columns: session.problem.board.columns,
    mineCount: problemFacts.mineCount,
    flagCount: session.puzzleState.flaggedCellIndices.length,
    mistakeCount: session.mistakeCount,
    visibleCells: getMinesweeperSessionVisibleCells(session),
    operation: play.operation,
    revealCell,
    toggleFlag,
    chordCell,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
