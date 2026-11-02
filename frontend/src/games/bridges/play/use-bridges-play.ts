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
} from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
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

/** クリアしたプレイの事実と、それを遊んだ問題の作業の量から導いた評価。 */
export type BridgesResult = BridgesSessionResult & {
  workload: BridgesSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: BridgesPlayScore;
};

/**
 * 最後の盤面操作で、橋に起きた変化。盤面が阻まれた操作を返し、プレイ画面が読み上げで知らせるために持つ。
 * `id` は操作ごとに変わり、同じ変化が続いても別の操作として知らせられるようにする。
 * - `changed`: 辺 `edge` の橋が `count` 本になった。
 * - `blocked`: 辺 `edge` に架けようとしたが、交わる辺 `crossingEdges` の橋に阻まれた。
 * - `undone`: 待ったで1つ前の盤面へ戻した。
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
    /** 辺ごとの橋の本数。 */
    bridges: readonly BridgeCount[];
    /** 島ごとの、橋の本数と数字の比べ。 */
    islandStatuses: readonly BridgesIslandStatus[];
    /** ここまでに待ったを使った回数。 */
    undoCount: number;
    /** 最後の盤面操作（橋を回す・待った）で橋に起きた変化。盤面を戻す・リセットの後は `null`。 */
    edgeNotice: BridgesEdgeNotice | null;
    /** 辺の橋を 1本 → 2本 → なし と回す。交わる橋に阻まれたら架けない。 */
    cycleEdge: (edge: number) => void;
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

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
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

/**
 * 難易度の問題を選んで遊ぶ。
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
 * クリアすると `result` に評価を返す。
 */
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

  const cycleEdge = useCallback((edge: number) => {
    const operatedAt = Date.now();
    const id = nextOperationId.current++;
    setPlay((current) => {
      const { session, crossingEdges } = cycleBridgesSessionEdge(
        current.session,
        edge,
        operatedAt,
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
  }, []);

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
    completedAt: session.finishedAt,
    elapsedMs,
    result,
    board: problem,
    bridges: puzzleState.bridges,
    islandStatuses: listBridgesIslandStatuses(problem, puzzleState),
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
