import { useCallback, useMemo, useRef, useState } from "react";

import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import type {
  IceFloorMazeProblemIdentity,
  IceFloorMazeRecordedProblemIdentity,
} from "@/games/ice-floor-maze/problem/problem";
import type { IceFloorMazePooledProblem } from "@/games/ice-floor-maze/problem/problem-pool";
import { selectIceFloorMazeProblemForDifficulty } from "@/games/ice-floor-maze/problem-selection";
import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { classifyIceFloorMazeDeadlock } from "@/games/ice-floor-maze/puzzle/deadlock";
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
 * `entersTrap` は閉じ込めを知らせていない状態から知らせる状態へ入ったか。知らせた後の滑りでは `false`。
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
     * 閉じ込めを知らせるプレイ中だけ `true`。ゴールで止まれず、もろい岩を崩さず薄い氷を割らない滑りでは同じところを回るだけの
     * 状態（閉じ込め）に入ったら知らせ、そこから崩す・割る滑りで進んでも、待った・盤面を戻すで戻るまで知らせ続ける。
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

  const wasTrapNoticed = isTrapNoticedAt(
    board,
    current.session.puzzleState,
    goal,
  );
  const trapNoticed = noticeTrapAfterSlide(
    board,
    session.puzzleState,
    goal,
    wasTrapNoticed,
  );
  return {
    ...applyPlaySession(current, session),
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
      entersTrap: trapNoticed && !wasTrapNoticed,
    },
    blockedInput: null,
  };
}

/**
 * 状態ごとの、閉じ込めを知らせるか。閉じ込めの判定は状態のグラフをたどるので、同じ状態を何度も判定しない。
 * 状態のオブジェクトは滑るたびに作られ、待ったで戻る先として使い回され、別の問題の状態と共有されないので、状態だけを鍵にする。
 * 閉じ込めから崩す・割る滑りで進んだ先は、詰みのままでも閉じ込めでなくなることがある。知らせが消えて抜け出せたと
 * 誤らせないよう、知らせた状態から滑った先は知らせ続ける（詰みから滑った先は詰みのまま）。
 */
const trapNoticedByState = new WeakMap<IceFloorMazeState, boolean>();

function isTrapNoticedAt(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  goal: number,
): boolean {
  return noticeTrapAfterSlide(board, state, goal, false);
}

function noticeTrapAfterSlide(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  goal: number,
  wasTrapNoticed: boolean,
): boolean {
  const cached = trapNoticedByState.get(state);
  if (cached !== undefined) {
    return cached;
  }

  const noticed =
    wasTrapNoticed ||
    classifyIceFloorMazeDeadlock(board, state, goal) === "trapped";
  trapNoticedByState.set(state, noticed);
  return noticed;
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
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        undoIceFloorMazeSession(current.session),
      );
      return next === current ? current : { ...next, ...clearedInputs };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartIceFloorMazeSession(current.session),
      );
      return next === current ? current : { ...next, ...clearedInputs };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createIceFloorMazeSession(current.session.problem, startedAt),
      ),
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
  const isTrapped = useMemo(
    () =>
      session.status === "playing" && isTrapNoticedAt(board, puzzleState, goal),
    [board, goal, puzzleState, session.status],
  );
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
