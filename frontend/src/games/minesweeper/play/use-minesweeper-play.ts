import { useCallback, useEffect, useMemo, useState } from "react";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import type { MinesweeperRestoredProblem } from "@/games/minesweeper/problem/generator";
import type { MinesweeperProblemIdentity } from "@/games/minesweeper/problem/problem";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import {
  calculateMinesweeperPlayScore,
  calculateMinesweeperSpeedFullScoreMs,
  calculateMinesweeperTimeDeltaMs,
  type MinesweeperPlayScore,
} from "@/games/minesweeper/score";
import {
  chordMinesweeperSessionCell,
  createMinesweeperSession,
  getMinesweeperSessionElapsedMs,
  getMinesweeperSessionResult,
  getMinesweeperSessionVisibleCells,
  type MinesweeperSession,
  type MinesweeperSessionResult,
  replayMinesweeperSession,
  revealMinesweeperSessionCell,
  toggleMinesweeperSessionFlag,
} from "@/games/minesweeper/session/session";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { selectProblemAvoiding } from "@/games/problem-selection";

/** クリア後は最終操作の結果を見せる `clearing` を経て `result` へ進む。 */
export type MinesweeperProgress = "playing" | "clearing" | "result";

export type MinesweeperResult = MinesweeperSessionResult & {
  mineCount: number;
  speedFullScoreMs: number;
  timeDeltaMs: number;
  score: MinesweeperPlayScore;
};

type MinesweeperPlayState = {
  seed: ProblemSeed;
  problemIdentity: MinesweeperProblemIdentity;
  session: MinesweeperSession;
  progress: MinesweeperProgress;
};

function getProgressAfterOperation(
  session: MinesweeperSession,
  current: MinesweeperProgress,
): MinesweeperProgress {
  return session.status === "cleared" && current === "playing"
    ? "clearing"
    : current;
}

function applySession(
  current: MinesweeperPlayState,
  session: MinesweeperSession,
): MinesweeperPlayState {
  return session === current.session
    ? current
    : {
        ...current,
        session,
        progress: getProgressAfterOperation(session, current.progress),
      };
}

function createPlayState(
  seed: ProblemSeed,
  { problem, identity }: MinesweeperRestoredProblem,
  startedAt: number,
): MinesweeperPlayState {
  const session = createMinesweeperSession(problem, startedAt);
  return {
    seed,
    problemIdentity: identity,
    session,
    progress: getProgressAfterOperation(session, "playing"),
  };
}

function createSelectedPlayState(
  difficulty: MinesweeperDifficulty,
  avoidedProblemId: ProblemId | undefined,
  startedAt: number,
): MinesweeperPlayState {
  const { seed, problem } = selectProblemAvoiding(
    (candidateSeed) =>
      selectMinesweeperProblemForDifficulty(difficulty, candidateSeed),
    avoidedProblemId,
  );
  return createPlayState(seed, problem, startedAt);
}

function createInitialPlayState(
  difficulty: MinesweeperDifficulty,
  initialProblem: MinesweeperRestoredProblem | undefined,
  avoidedProblemId: ProblemId | undefined,
  startedAt: number,
): MinesweeperPlayState {
  return initialProblem
    ? createPlayState(initialProblem.identity.seed, initialProblem, startedAt)
    : createSelectedPlayState(difficulty, avoidedProblemId, startedAt);
}

/**
 * 難易度の問題集から seed で選んだ問題を遊ぶ。
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
 * `startNewProblem` は遊んでいる問題を避けて選び直す。
 */
export function useMinesweeperPlay(
  difficulty: MinesweeperDifficulty,
  initialProblem?: MinesweeperRestoredProblem,
  avoidedProblemId?: ProblemId,
) {
  const [play, setPlay] = useState(() =>
    createInitialPlayState(
      difficulty,
      initialProblem,
      avoidedProblemId,
      Date.now(),
    ),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (play.session.status !== "playing") {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(timer);
  }, [play.session.status]);

  const revealCell = useCallback((cellIndex: number) => {
    const revealedAt = Date.now();
    setNow(revealedAt);
    setPlay((current) =>
      applySession(
        current,
        revealMinesweeperSessionCell(current.session, cellIndex, revealedAt),
      ),
    );
  }, []);

  const toggleFlag = useCallback((cellIndex: number) => {
    setPlay((current) =>
      applySession(
        current,
        toggleMinesweeperSessionFlag(current.session, cellIndex),
      ),
    );
  }, []);

  const chordCell = useCallback((cellIndex: number) => {
    const chordedAt = Date.now();
    setNow(chordedAt);
    setPlay((current) =>
      applySession(
        current,
        chordMinesweeperSessionCell(current.session, cellIndex, chordedAt),
      ),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => {
      const session = replayMinesweeperSession(current.session, startedAt);
      return {
        ...current,
        session,
        progress: getProgressAfterOperation(session, "playing"),
      };
    });
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) =>
      createSelectedPlayState(
        difficulty,
        createProblemId(current.problemIdentity),
        startedAt,
      ),
    );
  }, [difficulty]);

  const completeClearAnimation = useCallback(() => {
    setPlay((current) =>
      current.session.status === "cleared" && current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  const { session } = play;
  const mineCount = session.problem.board.mineCellIndices.length;
  const sessionResult = useMemo(
    () => getMinesweeperSessionResult(session, now),
    [now, session],
  );
  const result = useMemo<MinesweeperResult | null>(() => {
    if (!sessionResult) {
      return null;
    }

    const speedFullScoreMs = calculateMinesweeperSpeedFullScoreMs({
      minimumOpenCount: sessionResult.minimumOpenCount,
      mineCount,
    });
    return {
      ...sessionResult,
      mineCount,
      speedFullScoreMs,
      timeDeltaMs: calculateMinesweeperTimeDeltaMs({
        ...sessionResult,
        mineCount,
      }),
      score: calculateMinesweeperPlayScore({ ...sessionResult, mineCount }),
    };
  }, [mineCount, sessionResult]);

  return {
    difficulty,
    seed: play.seed,
    problemIdentity: play.problemIdentity,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    progress: play.progress,
    rows: session.problem.board.rows,
    columns: session.problem.board.columns,
    mineCount,
    flagCount: session.puzzleState.flaggedCellIndices.length,
    mistakeCount: session.mistakeCount,
    elapsedMs: getMinesweeperSessionElapsedMs(session, now),
    visibleCells: getMinesweeperSessionVisibleCells(session),
    status: session.status,
    result,
    revealCell,
    toggleFlag,
    chordCell,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
