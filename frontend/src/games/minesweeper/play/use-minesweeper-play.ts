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
import type { ProblemId } from "@/games/problem-id";
import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import { selectProblemAvoiding } from "@/games/problem-selection";

/** クリア後は最終操作の結果を見せる `clearing` を経て `result` へ進む。 */
export type MinesweeperProgress = "playing" | "clearing" | "result";

export type MinesweeperResult = MinesweeperSessionResult & {
  mineCount: number;
  speedFullScoreMs: number;
  timeDeltaMs: number;
  score: MinesweeperPlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createMinesweeperResult(
  sessionResult: MinesweeperSessionResult,
  mineCount: number,
): MinesweeperResult {
  return {
    ...sessionResult,
    mineCount,
    speedFullScoreMs: calculateMinesweeperSpeedFullScoreMs({
      minimumOpenCount: sessionResult.minimumOpenCount,
      mineCount,
    }),
    timeDeltaMs: calculateMinesweeperTimeDeltaMs({
      ...sessionResult,
      mineCount,
    }),
    score: calculateMinesweeperPlayScore({ ...sessionResult, mineCount }),
  };
}

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
  initialProblem: MinesweeperRestoredProblem | undefined,
  avoidedProblemId: ProblemId | undefined,
  startedAt: number,
): MinesweeperPlayState {
  if (initialProblem) {
    return createPlayState(
      initialProblem.identity.seed,
      initialProblem,
      startedAt,
    );
  }

  const { seed, problem } = selectProblemAvoiding(
    (candidateSeed) =>
      selectMinesweeperProblemForDifficulty(difficulty, candidateSeed),
    avoidedProblemId,
  );
  return createPlayState(seed, problem, startedAt);
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
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
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
  const result = useMemo<MinesweeperResult | null>(
    () =>
      sessionResult ? createMinesweeperResult(sessionResult, mineCount) : null,
    [mineCount, sessionResult],
  );

  return {
    difficulty,
    seed: play.seed,
    problemIdentity: play.problemIdentity,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    session,
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
