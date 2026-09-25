import { useCallback, useEffect, useMemo, useState } from "react";

import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { MinesweeperDifficulty } from "../difficulty";
import {
  type MinesweeperRestoredProblem,
  restoreMinesweeperProblemWithoutAnalysis,
} from "../problem/generator";
import type { MinesweeperProblemIdentity } from "../problem/problem";
import { selectMinesweeperProblemForDifficulty } from "../problem-selection";
import {
  calculateMinesweeperPlayScore,
  calculateMinesweeperSpeedFullScoreMs,
  calculateMinesweeperTimeDeltaMs,
  type MinesweeperPlayScore,
} from "../score";
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
} from "../session/session";

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

// 問題集が小さい場合でも「別の問題」で同じ問題に戻らないよう、選び直す回数の上限。
const maximumNewProblemSelectionAttempts = 8;

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

function createInitialPlayState(
  difficulty: MinesweeperDifficulty,
  initialProblemIdentity: MinesweeperProblemIdentity | undefined,
  startedAt: number,
): MinesweeperPlayState {
  if (initialProblemIdentity) {
    return createPlayState(
      initialProblemIdentity.seed,
      restoreMinesweeperProblemWithoutAnalysis(initialProblemIdentity),
      startedAt,
    );
  }

  const seed = createProblemSeed();
  return createPlayState(
    seed,
    selectMinesweeperProblemForDifficulty(difficulty, seed),
    startedAt,
  );
}

function createNewProblemPlayState(
  difficulty: MinesweeperDifficulty,
  currentProblemIdentity: MinesweeperProblemIdentity,
  startedAt: number,
): MinesweeperPlayState {
  let seed = createProblemSeed();
  let selected = selectMinesweeperProblemForDifficulty(difficulty, seed);
  for (
    let attempt = 1;
    attempt < maximumNewProblemSelectionAttempts &&
    selected.identity.seed === currentProblemIdentity.seed;
    attempt += 1
  ) {
    seed = createProblemSeed();
    selected = selectMinesweeperProblemForDifficulty(difficulty, seed);
  }
  return createPlayState(seed, selected, startedAt);
}

/**
 * 難易度の問題集から seed で選んだ問題を遊ぶ。
 * `initialProblemIdentity` を渡すと、その問題を再現して始める。
 */
export function useMinesweeperPlay(
  difficulty: MinesweeperDifficulty,
  initialProblemIdentity?: MinesweeperProblemIdentity,
) {
  const [play, setPlay] = useState(() =>
    createInitialPlayState(difficulty, initialProblemIdentity, Date.now()),
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
      createNewProblemPlayState(difficulty, current.problemIdentity, startedAt),
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
