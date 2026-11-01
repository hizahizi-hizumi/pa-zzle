import { useCallback, useMemo, useRef, useState } from "react";

import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import {
  listHitofudePuzzleStrandedCells,
  showsHitofudePuzzleStranding,
} from "@/games/hitofude-puzzle/play/stranding-notice";
import type {
  HitofudePuzzleProblem,
  HitofudePuzzleProblemIdentity,
  HitofudePuzzleSolveWorkload,
} from "@/games/hitofude-puzzle/problem/problem";
import type { HitofudePuzzlePooledProblem } from "@/games/hitofude-puzzle/problem/problem-pool";
import { selectHitofudePuzzleProblemForDifficulty } from "@/games/hitofude-puzzle/problem-selection";
import {
  findHitofudePuzzleDirection,
  getHitofudePuzzleNeighborCell,
  type HitofudePuzzleDirection,
} from "@/games/hitofude-puzzle/puzzle/board";
import { isHitofudePuzzleDeadEnd } from "@/games/hitofude-puzzle/puzzle/rules";
import { getHitofudePuzzleHead } from "@/games/hitofude-puzzle/puzzle/state";
import type { HitofudePuzzleTraceStep } from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  calculateHitofudePuzzlePlayScore,
  calculateHitofudePuzzleSpeedScoreRule,
  type HitofudePuzzlePlayScore,
} from "@/games/hitofude-puzzle/score";
import {
  beginHitofudePuzzleSessionStroke,
  canRestartHitofudePuzzleSession,
  canUndoHitofudePuzzleSession,
  createHitofudePuzzleSession,
  endHitofudePuzzleSessionStroke,
  getHitofudePuzzleSessionResult,
  type HitofudePuzzleSession,
  type HitofudePuzzleSessionPathChange,
  type HitofudePuzzleSessionResult,
  moveHitofudePuzzleSessionHeadToward,
  restartHitofudePuzzleSession,
  traceHitofudePuzzleSessionStroke,
  undoHitofudePuzzleSession,
} from "@/games/hitofude-puzzle/session/session";
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
export type HitofudePuzzleResult = HitofudePuzzleSessionResult & {
  workload: HitofudePuzzleSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: HitofudePuzzlePlayScore;
};

/**
 * 道を延ばせなかった操作。盤面が先端を揺らし、進もうとしたマスに×を点けて返すために持つ。
 * `id` は操作ごとに変わり、同じ所で続けて阻まれても別の操作として返せるようにする。
 */
export type HitofudePuzzleBlockedMove = {
  id: number;
  /** 先端から進もうとした向き。先端に隣り合わないマスを押したときは `null`。 */
  direction: HitofudePuzzleDirection | null;
  /** 進もうとしたマス（押したマス・指が入ったマス・矢印キーの向きの隣のマス）。盤面の外へ進もうとしたときは `null`。 */
  cell: number | null;
};

/** 操作が進もうとした先。 */
type HitofudePuzzleMoveTarget = Pick<
  HitofudePuzzleBlockedMove,
  "direction" | "cell"
>;

export type HitofudePuzzlePlay = GamePlay<
  HitofudePuzzleDifficulty,
  HitofudePuzzleProblemIdentity,
  HitofudePuzzleSession,
  HitofudePuzzleResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    board: HitofudePuzzleProblem;
    /** 始点から先端までに通ったマスの番号。先頭は常に始点。 */
    path: readonly number[];
    /** 全マスを通る前に、先端から延ばせるマスが無くなったか。 */
    isDeadEnd: boolean;
    /** 盤面で知らせる取り残しのマス。取り残しを知らせない難易度では常に空。 */
    strandedCells: readonly number[];
    /** 最後に道を延ばせなかった操作。 */
    blockedMove: HitofudePuzzleBlockedMove | null;
    /** ここまでの引き直しの回数。なぞりを離したとき・矢印キー・待った・盤面を戻すの後に数える。 */
    backtrackCount: number;
    /** ここまでに待ったを使った回数。 */
    undoCount: number;
    /** マスを押して道をなぞり始める。道のマスならそこまで巻き戻し、先端の隣なら延ばす。 */
    beginStroke: (cell: number) => void;
    /** なぞっている指が隣のマスへ移ったときに道を変える。 */
    traceStroke: (step: HitofudePuzzleTraceStep) => void;
    /** 指を離してなぞりを終える。押してから離すまでを待ったの1単位にする。 */
    endStroke: () => void;
    /** 先端からその向きの隣のマスへ先端を動かす。来た向きなら1マス縮む。 */
    moveHeadToward: (direction: HitofudePuzzleDirection) => void;
  };

type HitofudePuzzlePlayState = {
  problemIdentity: HitofudePuzzleProblemIdentity;
  workload: HitofudePuzzleSolveWorkload;
  session: HitofudePuzzleSession;
  progress: GameProgress;
  blockedMove: HitofudePuzzleBlockedMove | null;
};

function createPlayState(
  { problem, identity, workload }: HitofudePuzzlePooledProblem,
  startedAt: number,
): HitofudePuzzlePlayState {
  return {
    problemIdentity: identity,
    workload,
    session: createHitofudePuzzleSession(problem, startedAt),
    progress: "playing",
    blockedMove: null,
  };
}

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createHitofudePuzzleResult(
  sessionResult: HitofudePuzzleSessionResult,
  workload: HitofudePuzzleSolveWorkload,
): HitofudePuzzleResult {
  const speedRule = calculateHitofudePuzzleSpeedScoreRule(workload);
  return {
    ...sessionResult,
    workload,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateHitofudePuzzlePlayScore({
      elapsedMs: sessionResult.elapsedMs,
      backtrackCount: sessionResult.backtrackCount,
      workload,
    }),
  };
}

/** 道を変える操作の結果を反映する。延ばせなかったときは、阻まれた操作として残す。 */
function applyPathChange(
  current: HitofudePuzzlePlayState,
  { session, rejection }: HitofudePuzzleSessionPathChange,
  blockedMoveId: number,
  target: HitofudePuzzleMoveTarget,
): HitofudePuzzlePlayState {
  const applied = applyPlaySession(current, session);
  if (rejection === null) {
    return applied;
  }
  return {
    ...applied,
    blockedMove: {
      id: blockedMoveId,
      ...target,
    },
  };
}

/** 今の先端から `cell` へ進む操作の行き先。隣り合わなければ向きは `null`。 */
function targetCell(
  session: HitofudePuzzleSession,
  cell: number,
): HitofudePuzzleMoveTarget {
  return {
    direction: findHitofudePuzzleDirection(
      session.problem.size,
      getHitofudePuzzleHead(session.puzzleState),
      cell,
    ),
    cell,
  };
}

/** 今の先端から `direction` の向きへ進む操作の行き先。 */
function targetDirection(
  session: HitofudePuzzleSession,
  direction: HitofudePuzzleDirection,
): HitofudePuzzleMoveTarget {
  return {
    direction,
    cell: getHitofudePuzzleNeighborCell(
      session.problem.size,
      getHitofudePuzzleHead(session.puzzleState),
      direction,
    ),
  };
}

function selectProblem(
  difficulty: HitofudePuzzleDifficulty,
  avoidedProblemId: ProblemId | undefined,
): HitofudePuzzlePooledProblem {
  return selectProblemAvoiding(
    (seed) => selectHitofudePuzzleProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/**
 * 難易度の問題を選んで遊ぶ。
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
 * クリアすると `result` に評価を返す。
 */
export function useHitofudePuzzlePlay(
  difficulty: HitofudePuzzleDifficulty,
  initialProblem?: HitofudePuzzlePooledProblem,
  avoidedProblemId?: ProblemId,
): HitofudePuzzlePlay {
  const [play, setPlay] = useState(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity, workload, blockedMove } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const { problem, puzzleState } = session;
  const strandedCells = useMemo(
    () =>
      showsHitofudePuzzleStranding(difficulty)
        ? listHitofudePuzzleStrandedCells(problem, puzzleState.path)
        : [],
    [difficulty, problem, puzzleState],
  );

  const nextBlockedMoveId = useRef(0);

  const beginStroke = useCallback((cell: number) => {
    const operatedAt = Date.now();
    const blockedMoveId = nextBlockedMoveId.current++;
    setPlay((current) =>
      applyPathChange(
        current,
        beginHitofudePuzzleSessionStroke(current.session, cell, operatedAt),
        blockedMoveId,
        targetCell(current.session, cell),
      ),
    );
  }, []);

  const traceStroke = useCallback((step: HitofudePuzzleTraceStep) => {
    const operatedAt = Date.now();
    const blockedMoveId = nextBlockedMoveId.current++;
    setPlay((current) =>
      applyPathChange(
        current,
        traceHitofudePuzzleSessionStroke(current.session, step, operatedAt),
        blockedMoveId,
        targetCell(current.session, step.to),
      ),
    );
  }, []);

  const endStroke = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(
        current,
        endHitofudePuzzleSessionStroke(current.session),
      ),
    );
  }, []);

  const moveHeadToward = useCallback((direction: HitofudePuzzleDirection) => {
    const operatedAt = Date.now();
    const blockedMoveId = nextBlockedMoveId.current++;
    setPlay((current) =>
      applyPathChange(
        current,
        moveHitofudePuzzleSessionHeadToward(
          current.session,
          direction,
          operatedAt,
        ),
        blockedMoveId,
        targetDirection(current.session, direction),
      ),
    );
  }, []);

  const undo = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        undoHitofudePuzzleSession(current.session),
      );
      return next === current ? current : { ...next, blockedMove: null };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartHitofudePuzzleSession(current.session),
      );
      return next === current ? current : { ...next, blockedMove: null };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createHitofudePuzzleSession(current.session.problem, startedAt),
      ),
      blockedMove: null,
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
    const sessionResult = getHitofudePuzzleSessionResult(session);
    return sessionResult
      ? createHitofudePuzzleResult(sessionResult, workload)
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
    board: problem,
    path: puzzleState.path,
    isDeadEnd: isHitofudePuzzleDeadEnd(problem, puzzleState.path),
    strandedCells,
    blockedMove,
    backtrackCount: session.backtrackCount,
    undoCount: session.undoCount,
    canUndo: canUndoHitofudePuzzleSession(session),
    canRestart: canRestartHitofudePuzzleSession(session),
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
