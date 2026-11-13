import { useCallback, useMemo, useRef, useState } from "react";

import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
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
import type {
  HitofudePuzzleExtensionRejection,
  HitofudePuzzleTraceStep,
} from "@/games/hitofude-puzzle/puzzle/transitions";
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

export type HitofudePuzzleResult = HitofudePuzzleSessionResult & {
  workload: HitofudePuzzleSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: HitofudePuzzlePlayScore;
};

/** 盤面が先端を揺らし、進もうとしたマスに×を点けて返すために持つ。 */
export type HitofudePuzzleBlockedMove = {
  /** 操作ごとに変わり、同じ所で続けて阻まれても別の操作として返せるようにする。 */
  id: number;
  /** 先端に隣り合わないマスを押したときは `null`。 */
  direction: HitofudePuzzleDirection | null;
  /** 進もうとしたマス（押したマス・指が入ったマス・矢印キーの向きの隣のマス）。盤面の外へ進もうとしたときは `null`。 */
  cell: number | null;
};

/**
 * プレイ画面が読み上げで知らせるために持つ。
 * `id` は操作ごとに変わり、同じ変化が続いても別の操作として知らせられるようにする。
 * - `shortened`: 道が縮んだ（来た向きへ戻った・道の途中のマスを押した）。
 * - `undone`: 待ったで1つ前の道へ戻した。`lengthChange` は道のマス数の増減。
 */
export type HitofudePuzzlePathNotice = { id: number } & (
  | {
      change: "blocked";
      cell: number | null;
      reason: HitofudePuzzleExtensionRejection;
    }
  | {
      change: "shortened" | "extended";
      head: number;
    }
  | {
      change: "undone";
      head: number;
      lengthChange: number;
    }
);

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
    path: readonly number[];
    isDeadEnd: boolean;
    blockedMove: HitofudePuzzleBlockedMove | null;
    /** 盤面を戻すの後は `null`。 */
    pathNotice: HitofudePuzzlePathNotice | null;
    /** なぞりを離したとき・矢印キー・待った・盤面を戻すの後に数える。 */
    backtrackCount: number;
    undoCount: number;
    beginStroke: (cell: number) => void;
    traceStroke: (step: HitofudePuzzleTraceStep) => void;
    endStroke: () => void;
    moveHeadToward: (direction: HitofudePuzzleDirection) => void;
  };

type HitofudePuzzlePlayState = {
  problemIdentity: HitofudePuzzleProblemIdentity;
  workload: HitofudePuzzleSolveWorkload;
  session: HitofudePuzzleSession;
  progress: GameProgress;
  blockedMove: HitofudePuzzleBlockedMove | null;
  pathNotice: HitofudePuzzlePathNotice | null;
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
    pathNotice: null,
  };
}

/** プレイ中の結果と、記録から作り直す結果で共用する。 */
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

function findPathNotice(
  before: HitofudePuzzleSession,
  after: HitofudePuzzleSession,
  id: number,
): HitofudePuzzlePathNotice | null {
  const beforeLength = before.puzzleState.path.length;
  const afterLength = after.puzzleState.path.length;
  if (beforeLength === afterLength) {
    return null;
  }
  return {
    id,
    change: afterLength < beforeLength ? "shortened" : "extended",
    head: getHitofudePuzzleHead(after.puzzleState),
  };
}

function applyPathChange(
  current: HitofudePuzzlePlayState,
  { session, rejection }: HitofudePuzzleSessionPathChange,
  operationId: number,
  target: HitofudePuzzleMoveTarget,
): HitofudePuzzlePlayState {
  const applied = applyPlaySession(current, session);
  if (rejection === null) {
    const pathNotice = findPathNotice(current.session, session, operationId);
    return pathNotice === null ? applied : { ...applied, pathNotice };
  }
  return {
    ...applied,
    blockedMove: { id: operationId, ...target },
    pathNotice: {
      id: operationId,
      change: "blocked",
      cell: target.cell,
      reason: rejection,
    },
  };
}

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
  const {
    session,
    progress,
    problemIdentity,
    workload,
    blockedMove,
    pathNotice,
  } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const { problem, puzzleState } = session;

  const nextOperationId = useRef(0);

  const beginStroke = useCallback((cell: number) => {
    const operatedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      applyPathChange(
        current,
        beginHitofudePuzzleSessionStroke(current.session, cell, operatedAt),
        operationId,
        targetCell(current.session, cell),
      ),
    );
  }, []);

  const traceStroke = useCallback((step: HitofudePuzzleTraceStep) => {
    const operatedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      applyPathChange(
        current,
        traceHitofudePuzzleSessionStroke(current.session, step, operatedAt),
        operationId,
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
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      applyPathChange(
        current,
        moveHitofudePuzzleSessionHeadToward(
          current.session,
          direction,
          operatedAt,
        ),
        operationId,
        targetDirection(current.session, direction),
      ),
    );
  }, []);

  const undo = useCallback(() => {
    const operationId = nextOperationId.current++;
    setPlay((current) => {
      const session = undoHitofudePuzzleSession(current.session);
      const next = applyPlaySession(current, session);
      if (next === current) {
        return current;
      }
      const before = current.session.puzzleState.path;
      const after = session.puzzleState.path;
      return {
        ...next,
        blockedMove: null,
        pathNotice: {
          id: operationId,
          change: "undone",
          head: getHitofudePuzzleHead(session.puzzleState),
          lengthChange: after.length - before.length,
        },
      };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartHitofudePuzzleSession(current.session),
      );
      return next === current
        ? current
        : { ...next, blockedMove: null, pathNotice: null };
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
      pathNotice: null,
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
    completedAt: session.clearedAt,
    elapsedMs,
    result,
    board: problem,
    path: puzzleState.path,
    isDeadEnd: isHitofudePuzzleDeadEnd(problem, puzzleState.path),
    blockedMove,
    pathNotice,
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
