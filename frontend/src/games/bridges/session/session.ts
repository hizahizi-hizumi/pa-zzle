import {
  assertBridgesProblem,
  type BridgesProblem,
} from "@/games/bridges/problem/problem";
import { isBridgesSolved } from "@/games/bridges/puzzle/rules";
import {
  type BridgesPuzzleState,
  createInitialBridgesState,
} from "@/games/bridges/puzzle/state";
import {
  type BridgesCycleDirection,
  cycleBridgesEdge,
} from "@/games/bridges/puzzle/transitions";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

type BridgesEditingEdge = {
  edge: number;
  countBeforeEditing: number;
};

type BridgesSessionSnapshot = {
  puzzleState: BridgesPuzzleState;
  settledRetractionCount: number;
  editingEdge: BridgesEditingEdge | null;
};

export type BridgesSession = GameSession<BridgesProblem, BridgesPuzzleState> & {
  undoCount: number;
  /** 盤面を戻した回数。 */
  restartCount: number;
  /** 橋の本数を変えた入力（タップ・なぞり）の回数。待った・盤面を戻すは含まない。 */
  inputCount: number;
  blockedCount: number;
  settledRetractionCount: number;
  editingEdge: BridgesEditingEdge | null;
  /** 待ったで戻せる、各盤面操作の前の状態。古い順。 */
  history: readonly BridgesSessionSnapshot[];
};

export type BridgesSessionResult = {
  elapsedMs: number;
  undoCount: number;
  restartCount: number;
  inputCount: number;
  blockedCount: number;
  retractionCount: number;
};

export type BridgesSessionEdgeChange = {
  session: BridgesSession;
  crossingEdges: readonly number[] | null;
};

function getBridgesRetractionCount(session: BridgesSession): number {
  const editing = session.editingEdge;
  return (
    session.settledRetractionCount +
    (editing &&
    session.puzzleState.bridges[editing.edge]! < editing.countBeforeEditing
      ? 1
      : 0)
  );
}

function settleEditingEdge(session: BridgesSession): BridgesSession {
  return {
    ...session,
    settledRetractionCount: getBridgesRetractionCount(session),
    editingEdge: null,
  };
}

function takeSnapshot(session: BridgesSession): BridgesSessionSnapshot {
  return {
    puzzleState: session.puzzleState,
    settledRetractionCount: session.settledRetractionCount,
    editingEdge: session.editingEdge,
  };
}

export function createBridgesSession(
  problem: BridgesProblem,
  startedAt: number,
): BridgesSession {
  assertBridgesProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: createInitialBridgesState(problem),
    startedAt,
    clearedAt: null,
    undoCount: 0,
    restartCount: 0,
    inputCount: 0,
    blockedCount: 0,
    settledRetractionCount: 0,
    editingEdge: null,
    history: [],
  };
}

export function cycleBridgesSessionEdge(
  session: BridgesSession,
  edge: number,
  operatedAt: number,
  direction: BridgesCycleDirection = "forward",
): BridgesSessionEdgeChange {
  if (session.status !== "playing") {
    return { session, crossingEdges: null };
  }

  const change = cycleBridgesEdge(
    session.problem,
    session.puzzleState,
    edge,
    direction,
  );
  if (change.kind === "blocked") {
    return {
      session: { ...session, blockedCount: session.blockedCount + 1 },
      crossingEdges: change.crossingEdges,
    };
  }

  const continuesEditing = session.editingEdge?.edge === edge;
  const beforeInput = continuesEditing ? session : settleEditingEdge(session);
  const changed: BridgesSession = {
    ...beforeInput,
    puzzleState: change.state,
    history: [...session.history, takeSnapshot(session)],
    inputCount: session.inputCount + 1,
    editingEdge: beforeInput.editingEdge ?? {
      edge,
      countBeforeEditing: session.puzzleState.bridges[edge]!,
    },
  };
  return {
    session: isBridgesSolved(session.problem, change.state)
      ? {
          ...settleEditingEdge(changed),
          status: "cleared",
          clearedAt: operatedAt,
        }
      : changed,
    crossingEdges: null,
  };
}

/** 盤面を戻す前の操作は戻せない。 */
export function undoBridgesSession(session: BridgesSession): BridgesSession {
  if (!canUndoBridgesSession(session)) {
    return session;
  }

  return {
    ...session,
    ...session.history.at(-1)!,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

export function canUndoBridgesSession(session: BridgesSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

export function restartBridgesSession(session: BridgesSession): BridgesSession {
  if (!canRestartBridgesSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: createInitialBridgesState(session.problem),
    history: [],
    editingEdge: null,
    restartCount: session.restartCount + 1,
  };
}

export function canRestartBridgesSession(session: BridgesSession): boolean {
  return (
    session.status === "playing" &&
    session.puzzleState.bridges.some((count) => count !== 0)
  );
}

export function getBridgesSessionResult(
  session: BridgesSession,
): BridgesSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    inputCount: session.inputCount,
    blockedCount: session.blockedCount,
    retractionCount: getBridgesRetractionCount(session),
  };
}
