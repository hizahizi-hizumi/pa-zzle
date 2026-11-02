import { useCallback, useState } from "react";

import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import type {
  BridgesIdentifiedProblem,
  BridgesProblem,
  BridgesProblemIdentity,
} from "@/games/bridges/problem/problem";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import {
  type BridgesIslandStatus,
  listBridgesIslandStatuses,
} from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  type BridgesSession,
  canRestartBridgesSession,
  canUndoBridgesSession,
  createBridgesSession,
  cycleBridgesSessionEdge,
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

/** クリアしたプレイの評価。評価規則を持たないので、クリアしても評価は無く、盤面を見せたままにする。 */
export type BridgesResult = never;

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
    /** 辺の橋を 1本 → 2本 → なし と回す。交わる橋に阻まれたら架けない。 */
    cycleEdge: (edge: number) => void;
  };

type BridgesPlayState = {
  problemIdentity: BridgesProblemIdentity;
  session: BridgesSession;
  progress: GameProgress;
};

function createPlayState(
  { problem, identity }: BridgesIdentifiedProblem,
  startedAt: number,
): BridgesPlayState {
  return {
    problemIdentity: identity,
    session: createBridgesSession(problem, startedAt),
    progress: "playing",
  };
}

function selectProblem(
  difficulty: BridgesDifficulty,
  avoidedProblemId: ProblemId | undefined,
): BridgesIdentifiedProblem {
  return selectProblemAvoiding(
    (seed) => selectBridgesProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/**
 * 難易度の問題を選んで遊ぶ。
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
 */
export function useBridgesPlay(
  difficulty: BridgesDifficulty,
  initialProblem?: BridgesIdentifiedProblem,
  avoidedProblemId?: ProblemId,
): BridgesPlay {
  const [play, setPlay] = useState(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const { problem, puzzleState } = session;

  const cycleEdge = useCallback((edge: number) => {
    const operatedAt = Date.now();
    setPlay((current) =>
      applyPlaySession(
        current,
        cycleBridgesSessionEdge(current.session, edge, operatedAt).session,
      ),
    );
  }, []);

  const undo = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, undoBridgesSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, restartBridgesSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) =>
      startPlaySession(
        current,
        createBridgesSession(current.session.problem, startedAt),
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
    board: problem,
    bridges: puzzleState.bridges,
    islandStatuses: listBridgesIslandStatuses(problem, puzzleState),
    undoCount: session.undoCount,
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
