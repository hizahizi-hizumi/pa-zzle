import { useCallback, useMemo, useRef, useState } from "react";

import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import type { IceFloorMazeProblemIdentity } from "@/games/ice-floor-maze/problem/problem";
import type { IceFloorMazePooledProblem } from "@/games/ice-floor-maze/problem/problem-pool";
import { selectIceFloorMazeProblemForDifficulty } from "@/games/ice-floor-maze/problem-selection";
import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { classifyIceFloorMazeDeadlock } from "@/games/ice-floor-maze/puzzle/deadlock";
import {
  doesIceFloorMazeSlidePassGoal,
  type IceFloorMazeDirection,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  canRestartIceFloorMazeSession,
  canUndoIceFloorMazeSession,
  createIceFloorMazeSession,
  getIceFloorMazeSessionResult,
  type IceFloorMazeSession,
  type IceFloorMazeSessionResult,
  restartIceFloorMazeSession,
  slideIceFloorMazeSessionPiece,
  undoIceFloorMazeSession,
} from "@/games/ice-floor-maze/session/session";
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
 * 盤面へ伝える直前の滑りの結果。`id` は入力ごとに変わり、同じ向きを続けて選んでも別の操作として見分けられる。
 * - `slid`: `from` から `path` のマスを順に通り、最後のマス `to` で止まった。`passedGoal` はゴールを止まらずに通り過ぎたか。
 * - `blocked`: すぐ隣が岩か外壁で、1マスも動けなかった。盤面は変わらない。
 */
export type IceFloorMazeOperation =
  | {
      id: number;
      type: "slid";
      direction: IceFloorMazeDirection;
      from: number;
      to: number;
      path: readonly number[];
      passedGoal: boolean;
      isClearingMove: boolean;
    }
  | {
      id: number;
      type: "blocked";
      direction: IceFloorMazeDirection;
      from: number;
    };

/** クリアしたプレイの事実と、評価に使う問題の事実。 */
export type IceFloorMazeResult = IceFloorMazeSessionResult & {
  optimalMoveCount: number;
};

/** 完了したプレイの事実から結果を作る。 */
export function createIceFloorMazeResult(
  sessionResult: IceFloorMazeSessionResult,
  optimalMoveCount: number,
): IceFloorMazeResult {
  return { ...sessionResult, optimalMoveCount };
}

export type IceFloorMazePlay = GamePlay<
  IceFloorMazeDifficulty,
  IceFloorMazeProblemIdentity,
  IceFloorMazeSession,
  IceFloorMazeResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    board: IceFloorMazeBoard;
    goal: number;
    /** 駒のいるマス。 */
    position: number;
    moveCount: number;
    undoCount: number;
    restartCount: number;
    optimalMoveCount: number;
    /** 今の位置から行けるどの位置も今の位置へ戻れ、その中にゴールが無い（閉じ込め）プレイ中だけ `true`。 */
    isTrapped: boolean;
    operation: IceFloorMazeOperation | null;
    /** 入力した時点で駒を滑らせる。表示中の滑りの終わりを待たない。 */
    slide: (direction: IceFloorMazeDirection) => void;
  };

type IceFloorMazePlayState = {
  session: IceFloorMazeSession;
  problemIdentity: IceFloorMazeProblemIdentity;
  optimalMoveCount: number;
  progress: GameProgress;
  operation: IceFloorMazeOperation | null;
};

function createPlayState(
  { problem, identity, optimalMoveCount }: IceFloorMazePooledProblem,
  startedAt: number,
): IceFloorMazePlayState {
  return {
    session: createIceFloorMazeSession(problem, startedAt),
    problemIdentity: identity,
    optimalMoveCount,
    progress: "playing",
    operation: null,
  };
}

function selectProblem(
  difficulty: IceFloorMazeDifficulty,
  avoidedProblemId: ProblemId | undefined,
): IceFloorMazePooledProblem {
  return selectProblemAvoiding(
    (seed) => selectIceFloorMazeProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

function slideInPlay(
  current: IceFloorMazePlayState,
  direction: IceFloorMazeDirection,
  movedAt: number,
  operationId: number,
): IceFloorMazePlayState {
  if (current.progress !== "playing") {
    return current;
  }

  const attempt = slideIceFloorMazeSessionPiece(
    current.session,
    direction,
    movedAt,
  );
  if (attempt.outcome === "ignored") {
    return current;
  }

  const { slide, session } = attempt;
  if (slide.status === "blocked") {
    return {
      ...current,
      operation: {
        id: operationId,
        type: "blocked",
        direction,
        from: slide.from,
      },
    };
  }

  return {
    ...applyPlaySession(current, session),
    operation: {
      id: operationId,
      type: "slid",
      direction,
      from: slide.from,
      to: slide.to,
      path: slide.path,
      passedGoal: doesIceFloorMazeSlidePassGoal(slide, session.problem.goal),
      isClearingMove: session.status === "cleared",
    },
  };
}

/** `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。 */
export function useIceFloorMazePlay(
  difficulty: IceFloorMazeDifficulty,
  initialProblem?: IceFloorMazePooledProblem,
  avoidedProblemId?: ProblemId,
): IceFloorMazePlay {
  const [play, setPlay] = useState<IceFloorMazePlayState>(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, problemIdentity, optimalMoveCount } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextOperationId = useRef(0);

  const slide = useCallback((direction: IceFloorMazeDirection) => {
    const movedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) => slideInPlay(current, direction, movedAt, operationId));
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        undoIceFloorMazeSession(current.session),
      );
      return next === current ? current : { ...next, operation: null };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartIceFloorMazeSession(current.session),
      );
      return next === current ? current : { ...next, operation: null };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createIceFloorMazeSession(current.session.problem, startedAt),
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

  const { board, goal } = session.problem;
  const position = session.puzzleState;
  const isTrapped = useMemo(
    () =>
      session.status === "playing" &&
      classifyIceFloorMazeDeadlock(board, position, goal) === "trapped",
    [board, goal, position, session.status],
  );
  const result = useMemo(() => {
    const sessionResult = getIceFloorMazeSessionResult(session);
    return sessionResult
      ? createIceFloorMazeResult(sessionResult, optimalMoveCount)
      : null;
  }, [optimalMoveCount, session]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress: play.progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result,
    board,
    goal,
    position,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    optimalMoveCount,
    isTrapped,
    operation: play.operation,
    canUndo: canUndoIceFloorMazeSession(session),
    canRestart: canRestartIceFloorMazeSession(session),
    slide,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
