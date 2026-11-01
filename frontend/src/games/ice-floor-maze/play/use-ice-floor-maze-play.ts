import { useCallback, useMemo, useRef, useState } from "react";

import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import type {
  IceFloorMazeProblemIdentity,
  IceFloorMazeRecordedProblemIdentity,
} from "@/games/ice-floor-maze/problem/problem";
import type { IceFloorMazePooledProblem } from "@/games/ice-floor-maze/problem/problem-pool";
import { selectIceFloorMazeProblemForDifficulty } from "@/games/ice-floor-maze/problem-selection";
import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  classifyIceFloorMazeDeadlock,
  type IceFloorMazeDeadlockStatus,
} from "@/games/ice-floor-maze/puzzle/deadlock";
import {
  doesIceFloorMazeSlidePassGoal,
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
} from "@/games/ice-floor-maze/puzzle/rules";
import type {
  IceFloorMazeState,
  IceFloorMazeStateCell,
} from "@/games/ice-floor-maze/puzzle/state";
import {
  calculateIceFloorMazeMoveDelta,
  calculateIceFloorMazePlayScore,
  calculateIceFloorMazeSpeedScoreRule,
  getIceFloorMazeSpeedReference,
  type IceFloorMazePlayScore,
  type IceFloorMazeSpeedReference,
} from "@/games/ice-floor-maze/score";
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
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";

/**
 * 直前の成立した滑り。盤面はこれで跡を描き、滑りを動かす。`id` は滑りごとに変わる。
 * `from` から `path` のマスを順に通り、最後のマス `to` で止まった。`passedGoal` はゴールを止まらずに通り過ぎたか。
 * `crumbledRock` はこの滑りで崩れたもろい岩、`crackedIce` は割れて水面になった薄い氷のマス。
 * `entersTrap` はもうゴールに止まれないことを知らせていない状態から、知らせる状態へ入ったか。知らせた後の滑りでは `false`。
 * 成立しない向きの入力では変わらず、待った・盤面を戻す・リセット・別の問題で消える。
 */
export type IceFloorMazeLastSlide = {
  id: number;
  direction: IceFloorMazeDirection;
  from: number;
  to: number;
  path: readonly number[];
  crumbledRock: number | null;
  crackedIce: readonly number[];
  passedGoal: boolean;
  isClearingMove: boolean;
  entersTrap: boolean;
};

/**
 * 直前の入力が、すぐ隣が止め役か外壁で1マスも動けなかったこと。盤面はこれで押し戻しを動かす。盤面と直前の滑りは変わらない。
 * `stopper` は駒を阻んだ隣のマス（岩・もろい岩・水面・盤面の外）で、外周の外壁なら `null`。隣のもろい岩はこの入力では崩れない。
 * `id` は入力ごとに変わり、同じ向きを続けて選んでも別の入力として見分けられる。
 */
export type IceFloorMazeBlockedInput = {
  id: number;
  direction: IceFloorMazeDirection;
  from: number;
  stopper: number | null;
};

export type IceFloorMazeResult = IceFloorMazeSessionResult & {
  speedReference: IceFloorMazeSpeedReference;
  optimalMoveCount: number;
  moveDelta: number;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: IceFloorMazePlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createIceFloorMazeResult(
  sessionResult: IceFloorMazeSessionResult,
  problemIdentity: IceFloorMazeRecordedProblemIdentity,
  optimalMoveCount: number,
): IceFloorMazeResult {
  const speedReference = getIceFloorMazeSpeedReference(problemIdentity);
  const speedRule = calculateIceFloorMazeSpeedScoreRule({
    speedReference,
    optimalMoveCount,
  });

  return {
    ...sessionResult,
    speedReference,
    optimalMoveCount,
    moveDelta: calculateIceFloorMazeMoveDelta({
      moveCount: sessionResult.moveCount,
      optimalMoveCount,
    }),
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateIceFloorMazePlayScore({
      elapsedMs: sessionResult.elapsedMs,
      moveCount: sessionResult.moveCount,
      speedReference,
      optimalMoveCount,
    }),
  };
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
    /** 今の盤面のマス。崩れたもろい岩は氷に、割れた薄い氷は水面に変わっている。 */
    cells: readonly IceFloorMazeStateCell[];
    moveCount: number;
    undoCount: number;
    restartCount: number;
    optimalMoveCount: number;
    /**
     * もうゴールに止まれないことを知らせるプレイ中だけ `true`。ゴールで止まれず、もろい岩を崩さず薄い氷を割らない滑りでは
     * 同じところを回るだけの状態（閉じ込め）に入ったら知らせ、そこから崩す・割る滑りで進んでも、待った・盤面を戻すで戻っても、
     * ゴールで止まれる状態に戻るまで知らせ続ける。
     */
    isTrapped: boolean;
    lastSlide: IceFloorMazeLastSlide | null;
    /** 直前の入力が成立しなかったときだけ値を持つ。次に滑ったときや盤面が戻ったときに消える。 */
    blockedInput: IceFloorMazeBlockedInput | null;
    /** 入力した時点で駒を滑らせる。表示中の滑りの終わりを待たない。 */
    slide: (direction: IceFloorMazeDirection) => void;
  };

type IceFloorMazePlayState = {
  session: IceFloorMazeSession;
  problemIdentity: IceFloorMazeProblemIdentity;
  optimalMoveCount: number;
  progress: GameProgress;
  /** もうゴールに止まれないことを知らせているか。どの状態から来たかで決まるので、盤面の状態とは別に持つ。 */
  trapNoticed: boolean;
  lastSlide: IceFloorMazeLastSlide | null;
  blockedInput: IceFloorMazeBlockedInput | null;
};

/** プレイを始めたときと待った・盤面を戻すの後の、直前の滑りも成立しなかった入力も無い状態。 */
const clearedInputs = {
  lastSlide: null,
  blockedInput: null,
} as const satisfies Pick<IceFloorMazePlayState, "lastSlide" | "blockedInput">;

function createPlayState(
  { problem, identity, optimalMoveCount }: IceFloorMazePooledProblem,
  startedAt: number,
): IceFloorMazePlayState {
  return {
    session: createIceFloorMazeSession(problem, startedAt),
    problemIdentity: identity,
    optimalMoveCount,
    progress: "playing",
    trapNoticed: false,
    ...clearedInputs,
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
  inputId: number,
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
  const { board, goal } = session.problem;
  if (slide.status === "blocked") {
    return {
      ...current,
      blockedInput: {
        id: inputId,
        direction,
        from: slide.from,
        stopper: getIceFloorMazeNeighbor(board, slide.from, direction),
      },
    };
  }

  const trapNoticed = noticeTrap(
    board,
    session.puzzleState,
    goal,
    current.trapNoticed,
  );
  return {
    ...applyPlaySession(current, session),
    trapNoticed,
    lastSlide: {
      id: inputId,
      direction,
      from: slide.from,
      to: slide.to,
      path: slide.path,
      crumbledRock: slide.crumbledRock,
      crackedIce: slide.crackedIce,
      passedGoal: doesIceFloorMazeSlidePassGoal(slide, goal),
      isClearingMove: session.status === "cleared",
      entersTrap: trapNoticed && !current.trapNoticed,
    },
    blockedInput: null,
  };
}

/** 待った・盤面を戻すで戻った後の状態。戻った先でも、知らせるかを決め直す。 */
function returnInPlay(
  current: IceFloorMazePlayState,
  returned: IceFloorMazeSession,
): IceFloorMazePlayState {
  const next = applyPlaySession(current, returned);
  if (next === current) {
    return current;
  }
  const { board, goal } = returned.problem;
  return {
    ...next,
    trapNoticed: noticeTrap(
      board,
      returned.puzzleState,
      goal,
      current.trapNoticed,
    ),
    ...clearedInputs,
  };
}

/**
 * 状態ごとの、ゴールで止まれるかの判定。判定は状態のグラフをたどるので、同じ状態を何度も判定しない。
 * 状態のオブジェクトは滑るたびに作られ、待ったで戻る先として使い回され、別の問題の状態と共有されないので、状態だけを鍵にする。
 */
const deadlockStatusByState = new WeakMap<
  IceFloorMazeState,
  IceFloorMazeDeadlockStatus
>();

function classifyDeadlock(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  goal: number,
): IceFloorMazeDeadlockStatus {
  const cached = deadlockStatusByState.get(state);
  if (cached !== undefined) {
    return cached;
  }
  const status = classifyIceFloorMazeDeadlock(board, state, goal);
  deadlockStatusByState.set(state, status);
  return status;
}

/**
 * 移った先の状態で、もうゴールに止まれないことを知らせるか。閉じ込めに入ったら知らせる。
 * 知らせた後は、崩す・割る滑りで閉じ込めでなくなっても、待った・盤面を戻すで戻っても、詰みのままなら知らせ続ける。
 * 知らせが消えて、抜け出せた・戻れたと誤らせないため。ゴールで止まれる状態に戻ったら知らせをやめる。
 */
function noticeTrap(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  goal: number,
  wasTrapNoticed: boolean,
): boolean {
  const status = classifyDeadlock(board, state, goal);
  return (
    status === "trapped" || (wasTrapNoticed && status !== "goal-reachable")
  );
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
  const nextInputId = useRef(0);

  const slide = useCallback((direction: IceFloorMazeDirection) => {
    const movedAt = Date.now();
    const inputId = nextInputId.current++;
    setPlay((current) => slideInPlay(current, direction, movedAt, inputId));
  }, []);

  const undo = useCallback(() => {
    setPlay((current) =>
      returnInPlay(current, undoIceFloorMazeSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      returnInPlay(current, restartIceFloorMazeSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createIceFloorMazeSession(current.session.problem, startedAt),
      ),
      trapNoticed: false,
      ...clearedInputs,
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
  const { puzzleState } = session;
  const isTrapped = session.status === "playing" && play.trapNoticed;
  const result = useMemo(() => {
    const sessionResult = getIceFloorMazeSessionResult(session);
    return sessionResult
      ? createIceFloorMazeResult(
          sessionResult,
          problemIdentity,
          optimalMoveCount,
        )
      : null;
  }, [optimalMoveCount, problemIdentity, session]);

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
    position: puzzleState.position,
    cells: puzzleState.cells,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    optimalMoveCount,
    isTrapped,
    lastSlide: play.lastSlide,
    blockedInput: play.blockedInput,
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
