import { useCallback, useMemo, useRef, useState } from "react";

import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import type {
  HamiltonianPathProblem,
  HamiltonianPathProblemIdentity,
  HamiltonianPathSolveWorkload,
} from "@/games/hamiltonian-path/problem/problem";
import type { HamiltonianPathPooledProblem } from "@/games/hamiltonian-path/problem/problem-pool";
import { selectHamiltonianPathProblemForDifficulty } from "@/games/hamiltonian-path/problem-selection";
import {
  findHamiltonianPathDirection,
  type HamiltonianPathDirection,
} from "@/games/hamiltonian-path/puzzle/board";
import { isHamiltonianPathDeadEnd } from "@/games/hamiltonian-path/puzzle/rules";
import { getHamiltonianPathHead } from "@/games/hamiltonian-path/puzzle/state";
import type {
  HamiltonianPathExtensionRejection,
  HamiltonianPathTraceStep,
} from "@/games/hamiltonian-path/puzzle/transitions";
import {
  calculateHamiltonianPathPlayScore,
  calculateHamiltonianPathSpeedScoreRule,
  type HamiltonianPathPlayScore,
} from "@/games/hamiltonian-path/score";
import {
  beginHamiltonianPathSessionStroke,
  canRestartHamiltonianPathSession,
  canUndoHamiltonianPathSession,
  createHamiltonianPathSession,
  endHamiltonianPathSessionStroke,
  getHamiltonianPathSessionResult,
  type HamiltonianPathSession,
  type HamiltonianPathSessionPathChange,
  type HamiltonianPathSessionResult,
  moveHamiltonianPathSessionHeadToward,
  restartHamiltonianPathSession,
  traceHamiltonianPathSessionStroke,
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
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";

/** クリアしたプレイの事実と、それを遊んだ問題の作業の量から導いた評価。 */
export type HamiltonianPathResult = HamiltonianPathSessionResult & {
  workload: HamiltonianPathSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: HamiltonianPathPlayScore;
};

/**
 * 道を延ばせなかった操作。盤面が先端を揺らし、阻んだ仕切りを強調して返すために持つ。
 * `id` は操作ごとに変わり、同じ理由で続けて阻まれても別の操作として返せるようにする。
 */
export type HamiltonianPathBlockedMove = {
  id: number;
  reason: HamiltonianPathExtensionRejection;
  /** 阻まれたときの道の先端。 */
  head: number;
  /** 先端から進もうとした向き。先端に隣り合わないマスを押したときは `null`。 */
  direction: HamiltonianPathDirection | null;
};

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
    /** 全マスを通る前に、先端から延ばせるマスが無くなったか。 */
    isDeadEnd: boolean;
    /** 最後に道を延ばせなかった操作。 */
    blockedMove: HamiltonianPathBlockedMove | null;
    /** マスを押して道をなぞり始める。道のマスならそこまで巻き戻し、先端の隣なら延ばす。 */
    beginStroke: (cell: number) => void;
    /** なぞっている指が隣のマスへ移ったときに道を変える。 */
    traceStroke: (step: HamiltonianPathTraceStep) => void;
    /** 指を離してなぞりを終える。押してから離すまでを待ったの1単位にする。 */
    endStroke: () => void;
    /** 先端からその向きの隣のマスへ先端を動かす。来た向きなら1マス縮む。 */
    moveHeadToward: (direction: HamiltonianPathDirection) => void;
  };

type HamiltonianPathPlayState = {
  problemIdentity: HamiltonianPathProblemIdentity;
  workload: HamiltonianPathSolveWorkload;
  session: HamiltonianPathSession;
  progress: GameProgress;
  blockedMove: HamiltonianPathBlockedMove | null;
};

function createPlayState(
  { problem, identity, workload }: HamiltonianPathPooledProblem,
  startedAt: number,
): HamiltonianPathPlayState {
  return {
    problemIdentity: identity,
    workload,
    session: createHamiltonianPathSession(problem, startedAt),
    progress: "playing",
    blockedMove: null,
  };
}

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createHamiltonianPathResult(
  sessionResult: HamiltonianPathSessionResult,
  workload: HamiltonianPathSolveWorkload,
): HamiltonianPathResult {
  const speedRule = calculateHamiltonianPathSpeedScoreRule(workload);
  return {
    ...sessionResult,
    workload,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateHamiltonianPathPlayScore({
      elapsedMs: sessionResult.elapsedMs,
      backtrackCount: sessionResult.backtrackCount,
      workload,
    }),
  };
}

/** 道を変える操作の結果を反映する。延ばせなかったときは、阻まれた操作として残す。 */
function applyPathChange(
  current: HamiltonianPathPlayState,
  { session, rejection }: HamiltonianPathSessionPathChange,
  blockedMoveId: number,
  direction: HamiltonianPathDirection | null,
): HamiltonianPathPlayState {
  const applied = applyPlaySession(current, session);
  if (rejection === null) {
    return applied;
  }
  return {
    ...applied,
    blockedMove: {
      id: blockedMoveId,
      reason: rejection,
      head: getHamiltonianPathHead(current.session.puzzleState),
      direction,
    },
  };
}

/** 今の先端から `cell` へ進む向き。隣り合わなければ `null`。 */
function findDirectionFromHead(
  session: HamiltonianPathSession,
  cell: number,
): HamiltonianPathDirection | null {
  return findHamiltonianPathDirection(
    session.problem.size,
    getHamiltonianPathHead(session.puzzleState),
    cell,
  );
}

function selectProblem(
  difficulty: HamiltonianPathDifficulty,
  avoidedProblemId: ProblemId | undefined,
): HamiltonianPathPooledProblem {
  return selectProblemAvoiding(
    (seed) => selectHamiltonianPathProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/**
 * 難易度の問題を選んで遊ぶ。
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
 * クリアすると `result` に評価を返す。
 */
export function useHamiltonianPathPlay(
  difficulty: HamiltonianPathDifficulty,
  initialProblem?: HamiltonianPathPooledProblem,
  avoidedProblemId?: ProblemId,
): HamiltonianPathPlay {
  const [play, setPlay] = useState(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity, workload, blockedMove } = play;
  const elapsedMs = useSessionElapsedMs(session);

  const nextBlockedMoveId = useRef(0);

  const beginStroke = useCallback((cell: number) => {
    const operatedAt = Date.now();
    const blockedMoveId = nextBlockedMoveId.current++;
    setPlay((current) =>
      applyPathChange(
        current,
        beginHamiltonianPathSessionStroke(current.session, cell, operatedAt),
        blockedMoveId,
        findDirectionFromHead(current.session, cell),
      ),
    );
  }, []);

  const traceStroke = useCallback((step: HamiltonianPathTraceStep) => {
    const operatedAt = Date.now();
    const blockedMoveId = nextBlockedMoveId.current++;
    setPlay((current) =>
      applyPathChange(
        current,
        traceHamiltonianPathSessionStroke(current.session, step, operatedAt),
        blockedMoveId,
        findDirectionFromHead(current.session, step.to),
      ),
    );
  }, []);

  const endStroke = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(
        current,
        endHamiltonianPathSessionStroke(current.session),
      ),
    );
  }, []);

  const moveHeadToward = useCallback((direction: HamiltonianPathDirection) => {
    const operatedAt = Date.now();
    const blockedMoveId = nextBlockedMoveId.current++;
    setPlay((current) =>
      applyPathChange(
        current,
        moveHamiltonianPathSessionHeadToward(
          current.session,
          direction,
          operatedAt,
        ),
        blockedMoveId,
        direction,
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

  const result = useMemo(() => {
    const sessionResult = getHamiltonianPathSessionResult(session);
    return sessionResult
      ? createHamiltonianPathResult(sessionResult, workload)
      : null;
  }, [session, workload]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result,
    board: session.problem,
    path: session.puzzleState.path,
    isDeadEnd: isHamiltonianPathDeadEnd(
      session.problem,
      session.puzzleState.path,
    ),
    blockedMove,
    canUndo: canUndoHamiltonianPathSession(session),
    canRestart: canRestartHamiltonianPathSession(session),
    beginStroke,
    traceStroke,
    endStroke,
    moveHeadToward,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
