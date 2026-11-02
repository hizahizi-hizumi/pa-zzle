import { useCallback, useState } from "react";

import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import type {
  HamiltonianPathIdentifiedProblem,
  HamiltonianPathProblem,
  HamiltonianPathProblemIdentity,
} from "@/games/hamiltonian-path/problem/problem";
import { selectHamiltonianPathProblemForDifficulty } from "@/games/hamiltonian-path/problem-selection";
import {
  canRestartHamiltonianPathSession,
  canUndoHamiltonianPathSession,
  createHamiltonianPathSession,
  extendHamiltonianPathSessionPath,
  type HamiltonianPathSession,
  moveHamiltonianPathSessionHead,
  restartHamiltonianPathSession,
  rewindHamiltonianPathSessionPath,
  undoHamiltonianPathSession,
} from "@/games/hamiltonian-path/session/session";
import {
  applyPlaySession,
  completePlayClearAnimation,
  type GamePlay,
  type GameProgress,
  type RestartableGamePlay,
  startPlaySession,
  type UndoableGamePlay,
  useSessionElapsedMs,
} from "@/games/play";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";

/**
 * クリアしたプレイの評価。評価（スコア）を作るまでは評価が無く、`result` は常に `null` になる。
 * そのためクリア後も結果画面へは進まず、盤面を見せたままにする。
 */
export type HamiltonianPathResult = never;

export type HamiltonianPathPlay = GamePlay<
  HamiltonianPathDifficulty,
  HamiltonianPathProblemIdentity,
  HamiltonianPathSession,
  HamiltonianPathResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    board: HamiltonianPathProblem;
    /** 始点から先端までに通ったマスの番号。先頭は常に始点。 */
    path: readonly number[];
    /** 道の先端から隣のマスへ道を1マス延ばす。 */
    extendPath: (cell: number) => void;
    /** 道の先端を隣のマスへ動かす。直前のマスへ動かすと1マス縮む。 */
    moveHead: (cell: number) => void;
    /** 道の途中のマス（始点を含む）まで道を巻き戻す。 */
    rewindPath: (cell: number) => void;
  };

type HamiltonianPathPlayState = {
  problemIdentity: HamiltonianPathProblemIdentity;
  session: HamiltonianPathSession;
  progress: GameProgress;
};

function createPlayState(
  { problem, identity }: HamiltonianPathIdentifiedProblem,
  startedAt: number,
): HamiltonianPathPlayState {
  return {
    problemIdentity: identity,
    session: createHamiltonianPathSession(problem, startedAt),
    progress: "playing",
  };
}

function selectProblem(
  difficulty: HamiltonianPathDifficulty,
  avoidedProblemId: ProblemId | undefined,
): HamiltonianPathIdentifiedProblem {
  return selectProblemAvoiding(
    (seed) => selectHamiltonianPathProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/**
 * 難易度の問題を選んで遊ぶ。
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
 */
export function useHamiltonianPathPlay(
  difficulty: HamiltonianPathDifficulty,
  initialProblem?: HamiltonianPathIdentifiedProblem,
  avoidedProblemId?: ProblemId,
): HamiltonianPathPlay {
  const [play, setPlay] = useState(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity } = play;
  const elapsedMs = useSessionElapsedMs(session);

  const extendPath = useCallback((cell: number) => {
    const operatedAt = Date.now();
    setPlay((current) =>
      applyPlaySession(
        current,
        extendHamiltonianPathSessionPath(current.session, cell, operatedAt)
          .session,
      ),
    );
  }, []);

  const moveHead = useCallback((cell: number) => {
    const operatedAt = Date.now();
    setPlay((current) =>
      applyPlaySession(
        current,
        moveHamiltonianPathSessionHead(current.session, cell, operatedAt)
          .session,
      ),
    );
  }, []);

  const rewindPath = useCallback((cell: number) => {
    setPlay((current) =>
      applyPlaySession(
        current,
        rewindHamiltonianPathSessionPath(current.session, cell),
      ),
    );
  }, []);

  const undo = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, undoHamiltonianPathSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, restartHamiltonianPathSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) =>
      startPlaySession(
        current,
        createHamiltonianPathSession(current.session.problem, startedAt),
      ),
    );
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

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result: null,
    board: session.problem,
    path: session.puzzleState.path,
    canUndo: canUndoHamiltonianPathSession(session),
    canRestart: canRestartHamiltonianPathSession(session),
    extendPath,
    moveHead,
    rewindPath,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
