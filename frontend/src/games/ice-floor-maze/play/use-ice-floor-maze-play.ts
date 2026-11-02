import { useCallback, useMemo, useRef, useState } from "react";

import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import type {
  IceFloorMazeProblemIdentity,
  IceFloorMazeRecordedProblemIdentity,
} from "@/games/ice-floor-maze/problem/problem";
import type { IceFloorMazePooledProblem } from "@/games/ice-floor-maze/problem/problem-pool";
import { selectIceFloorMazeProblemForDifficulty } from "@/games/ice-floor-maze/problem-selection";
import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { isIceFloorMazeDeadlocked } from "@/games/ice-floor-maze/puzzle/deadlock";
import {
  doesIceFloorMazeSlidePassGoal,
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
  type IceFloorMazeShift,
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
 * `pushedSnow` は押し出した雪（雪のマスから雪山になったマスへ）で、駒は雪のマスで止まった。
 * `movedBlock` は押して動かした滑る氷の塊で、駒は塊の元のマスに入ってから塊と一緒に進み、塊の止まったマスの手前で止まった。
 * `stoppedOnFloor` は止め役にぶつからず、床に入って止まったか。
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
  pushedSnow: IceFloorMazeShift | null;
  movedBlock: IceFloorMazeShift | null;
  stoppedOnFloor: boolean;
  passedGoal: boolean;
  isClearingMove: boolean;
  entersTrap: boolean;
};

/**
 * 直前の入力が、すぐ隣が止め役か外壁で1マスも動けなかったこと。盤面はこれで押し戻しを動かす。盤面と直前の滑りは変わらない。
 * `stopper` は駒を阻んだ隣のマス（岩・もろい岩・水面・雪山・盤面の外・押し出せない雪・滑る氷の塊のあるマス）で、外周の外壁なら `null`。
 * 隣のもろい岩はこの入力では崩れず、隣の滑る氷の塊は動かない。
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
    /** 今の盤面のマス。崩れたもろい岩は氷に、割れた薄い氷は水面に、押し出した雪は氷に、押し出した先は雪山に変わっている。 */
    cells: readonly IceFloorMazeStateCell[];
    /** 滑る氷の塊のあるマス（昇順）。 */
    blocks: readonly number[];
    moveCount: number;
    undoCount: number;
    restartCount: number;
    optimalMoveCount: number;
    /**
     * もうゴールに止まれないことを知らせるプレイ中だけ `true`。詰み（どう滑ってもゴールで止まれない）のまま、
     * 待った・盤面を戻すを使わずに `deadlockNoticeSlideCount` 回滑ったら知らせ、そこから待った・盤面を戻すで戻っても、
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
  /**
   * 詰みの状態から、待った・盤面を戻すを使わずに続けた滑りの数。詰みに入った時点と、待った・盤面を戻すで詰みの状態へ
   * 戻った時点で 0 になる。詰みでない状態にいる間は `null`。
   */
  deadlockedSlideCount: number | null;
  /** もうゴールに止まれないことを知らせているか。どの状態から来たかで決まるので、盤面の状態とは別に持つ。 */
  trapNoticed: boolean;
  lastSlide: IceFloorMazeLastSlide | null;
  blockedInput: IceFloorMazeBlockedInput | null;
};

/**
 * 詰みに入ってから、気づいていなさそうと見なして知らせるまでの滑りの数。詰みに入った滑りは数えない。
 * 詰みに入ってすぐ知らせると試行錯誤を遮るので、詰みのまま滑り続けて気づいていなさそうなときだけ知らせる。
 */
const deadlockNoticeSlideCount = 10;

/** 詰みでない状態の、知らせまでの数と知らせ。 */
const notDeadlocked = {
  deadlockedSlideCount: null,
  trapNoticed: false,
} as const satisfies Pick<
  IceFloorMazePlayState,
  "deadlockedSlideCount" | "trapNoticed"
>;

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
    ...notDeadlocked,
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

  const deadlockNotice = noticeDeadlockAfterSlide(
    current,
    isDeadlocked(board, session.puzzleState, goal),
  );
  return {
    ...applyPlaySession(current, session),
    ...deadlockNotice,
    lastSlide: {
      id: inputId,
      direction,
      from: slide.from,
      to: slide.to,
      path: slide.path,
      crumbledRock: slide.crumbledRock,
      crackedIce: slide.crackedIce,
      pushedSnow: slide.pushedSnow,
      movedBlock: slide.movedBlock,
      stoppedOnFloor: board.cells[slide.to] === "floor",
      passedGoal: doesIceFloorMazeSlidePassGoal(slide, goal),
      isClearingMove: session.status === "cleared",
      entersTrap: deadlockNotice.trapNoticed && !current.trapNoticed,
    },
    blockedInput: null,
  };
}

/** 待った・盤面を戻すで戻った後の状態。戻った先で知らせるかを決め直し、知らせまでの滑りを数え直す。 */
function returnInPlay(
  current: IceFloorMazePlayState,
  returned: IceFloorMazeSession,
): IceFloorMazePlayState {
  const next = applyPlaySession(current, returned);
  if (next === current) {
    return current;
  }
  const { board, goal } = returned.problem;
  const deadlockNotice = isDeadlocked(board, returned.puzzleState, goal)
    ? { deadlockedSlideCount: 0, trapNoticed: current.trapNoticed }
    : notDeadlocked;
  return {
    ...next,
    ...deadlockNotice,
    ...clearedInputs,
  };
}

/**
 * 状態ごとの、詰みかの判定。判定は状態のグラフをたどるので、同じ状態を何度も判定しない。
 * 状態のオブジェクトは滑るたびに作られ、待ったで戻る先として使い回され、別の問題の状態と共有されないので、状態だけを鍵にする。
 */
const deadlockedByState = new WeakMap<IceFloorMazeState, boolean>();

function isDeadlocked(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  goal: number,
): boolean {
  const cached = deadlockedByState.get(state);
  if (cached !== undefined) {
    return cached;
  }
  const deadlocked = isIceFloorMazeDeadlocked(board, state, goal);
  deadlockedByState.set(state, deadlocked);
  return deadlocked;
}

/**
 * 滑った後に、もうゴールに止まれないことを知らせるか。詰みの状態から滑るたびに数え、
 * `deadlockNoticeSlideCount` 回に達したら知らせる。詰みの状態からどう滑っても詰みのままなので、
 * 一度知らせたら滑っても消えない。
 */
function noticeDeadlockAfterSlide(
  { deadlockedSlideCount, trapNoticed }: IceFloorMazePlayState,
  deadlocked: boolean,
): Pick<IceFloorMazePlayState, "deadlockedSlideCount" | "trapNoticed"> {
  if (!deadlocked) {
    return notDeadlocked;
  }
  const nextCount =
    deadlockedSlideCount === null ? 0 : deadlockedSlideCount + 1;
  return {
    deadlockedSlideCount: nextCount,
    trapNoticed: trapNoticed || nextCount >= deadlockNoticeSlideCount,
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
      ...notDeadlocked,
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
    blocks: puzzleState.blocks,
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

export const _private = { deadlockNoticeSlideCount };
