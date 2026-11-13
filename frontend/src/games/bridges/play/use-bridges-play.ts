import { useCallback, useMemo, useRef, useState } from "react";

import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import type {
  BridgesProblem,
  BridgesProblemIdentity,
} from "@/games/bridges/problem/problem";
import type { BridgesPooledProblem } from "@/games/bridges/problem/problem-pool";
import {
  type BridgesSolveWorkload,
  measureBridgesSolveWorkload,
} from "@/games/bridges/problem/workload";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import {
  type BridgesIslandStatus,
  listBridgesIslandStatuses,
  listBridgesIsolatedIslands,
} from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import type { BridgesCycleDirection } from "@/games/bridges/puzzle/transitions";
import {
  type BridgesPlayScore,
  calculateBridgesPlayScore,
  calculateBridgesSpeedScoreRule,
} from "@/games/bridges/score";
import {
  type BridgesSession,
  type BridgesSessionResult,
  canRestartBridgesSession,
  canUndoBridgesSession,
  createBridgesSession,
  cycleBridgesSessionEdge,
  getBridgesSessionResult,
  restartBridgesSession,
  undoBridgesSession,
} from "@/games/bridges/session/session";
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

export type BridgesResult = BridgesSessionResult & {
  workload: BridgesSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: BridgesPlayScore;
};

/**
 * 最後の盤面操作で、橋に起きた変化。盤面が阻まれた操作を返し、プレイ画面が読み上げで知らせるために持つ。
 * `id` は操作ごとに変わり、同じ変化が続いても別の操作として知らせられるようにする。
 */
export type BridgesEdgeNotice = { id: number } & (
  | { change: "changed"; edge: number; count: BridgeCount }
  | { change: "blocked"; edge: number; crossingEdges: readonly number[] }
  | { change: "undone" }
);

export type BridgesPlay = GamePlay<
  BridgesDifficulty,
  BridgesProblemIdentity,
  BridgesSession,
  BridgesResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    board: BridgesProblem;
    bridges: readonly BridgeCount[];
    islandStatuses: readonly BridgesIslandStatus[];
    /** 全部の島が数字どおりなのにクリアにならないときだけ、いちばん大きな組から離れている島を返す。 */
    isolatedIslands: readonly number[];
    undoCount: number;
    /** 盤面を戻す・リセットの後は `null`。 */
    edgeNotice: BridgesEdgeNotice | null;
    /** `direction` を省くと 1本 → 2本 → なし に回す。 */
    cycleEdge: (edge: number, direction?: BridgesCycleDirection) => void;
  };

type BridgesPlayState = {
  problemIdentity: BridgesProblemIdentity;
  workload: BridgesSolveWorkload;
  session: BridgesSession;
  progress: GameProgress;
  edgeNotice: BridgesEdgeNotice | null;
};

function createPlayState(
  pooled: BridgesPooledProblem,
  startedAt: number,
): BridgesPlayState {
  const { problem, identity } = pooled;
  return {
    problemIdentity: identity,
    workload: measureBridgesSolveWorkload(pooled),
    session: createBridgesSession(problem, startedAt),
    progress: "playing",
    edgeNotice: null,
  };
}

/** プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createBridgesResult(
  sessionResult: BridgesSessionResult,
  workload: BridgesSolveWorkload,
): BridgesResult {
  const speedRule = calculateBridgesSpeedScoreRule(workload);
  return {
    ...sessionResult,
    workload,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateBridgesPlayScore({
      elapsedMs: sessionResult.elapsedMs,
      workload,
    }),
  };
}

function selectProblem(
  difficulty: BridgesDifficulty,
  avoidedProblemId: ProblemId | undefined,
): BridgesPooledProblem {
  return selectProblemAvoiding(
    (seed) => selectBridgesProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

export function useBridgesPlay(
  difficulty: BridgesDifficulty,
  initialProblem?: BridgesPooledProblem,
  avoidedProblemId?: ProblemId,
): BridgesPlay {
  const [play, setPlay] = useState(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity, workload } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const { problem, puzzleState } = session;

  const nextOperationId = useRef(0);

  const cycleEdge = useCallback(
    (edge: number, direction: BridgesCycleDirection = "forward") => {
      const operatedAt = Date.now();
      const id = nextOperationId.current++;
      setPlay((current) => {
        const { session, crossingEdges } = cycleBridgesSessionEdge(
          current.session,
          edge,
          operatedAt,
          direction,
        );
        if (crossingEdges !== null) {
          return {
            ...current,
            session,
            edgeNotice: { id, change: "blocked", edge, crossingEdges },
          };
        }
        const next = applyPlaySession(current, session);
        return next === current
          ? current
          : {
              ...next,
              edgeNotice: {
                id,
                change: "changed",
                edge,
                count: session.puzzleState.bridges[edge]!,
              },
            };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    const id = nextOperationId.current++;
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        undoBridgesSession(current.session),
      );
      return next === current
        ? current
        : { ...next, edgeNotice: { id, change: "undone" } };
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartBridgesSession(current.session),
      );
      return next === current ? current : { ...next, edgeNotice: null };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createBridgesSession(current.session.problem, startedAt),
      ),
      edgeNotice: null,
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
    const sessionResult = getBridgesSessionResult(session);
    return sessionResult ? createBridgesResult(sessionResult, workload) : null;
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
    bridges: puzzleState.bridges,
    islandStatuses: listBridgesIslandStatuses(problem, puzzleState),
    isolatedIslands: listBridgesIsolatedIslands(problem, puzzleState),
    undoCount: session.undoCount,
    edgeNotice: play.edgeNotice,
    canUndo: canUndoBridgesSession(session),
    canRestart: canRestartBridgesSession(session),
    cycleEdge,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
