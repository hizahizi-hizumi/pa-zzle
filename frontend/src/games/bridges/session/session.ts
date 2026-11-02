import {
  assertBridgesProblem,
  type BridgesProblem,
} from "@/games/bridges/problem/problem";
import { isBridgesSolved } from "@/games/bridges/puzzle/rules";
import {
  type BridgesPuzzleState,
  createInitialBridgesState,
} from "@/games/bridges/puzzle/state";
import { cycleBridgesEdge } from "@/games/bridges/puzzle/transitions";
import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";

export type BridgesSession = GameSession<BridgesProblem, BridgesPuzzleState> & {
  /** 待ったで盤面操作を取り消した回数。 */
  undoCount: number;
  /** 盤面を戻した回数。 */
  restartCount: number;
  /** 橋の本数を変えた入力（タップ・なぞり）の回数。待った・盤面を戻すは含まない。 */
  inputCount: number;
  /** 交わる橋に阻まれて架けられなかった入力の回数。 */
  blockedCount: number;
  /** 待ったで戻せる、各盤面操作の前の状態。古い順。盤面を戻すと空にする。 */
  history: readonly BridgesPuzzleState[];
};

/** 評価と記録に使うプレイ事実。採点はしない。 */
export type BridgesSessionResult = {
  elapsedMs: number;
  undoCount: number;
  restartCount: number;
  inputCount: number;
  blockedCount: number;
};

/**
 * 辺の橋を回す操作の結果。交わる橋に阻まれたときは `crossingEdges` にその橋のある辺を添え、盤面は変えない。
 * プレイ中でない session への操作は受け付けず、阻まれた辺も添えない。
 */
export type BridgesSessionEdgeChange = {
  session: BridgesSession;
  crossingEdges: readonly number[] | null;
};

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
    finishedAt: null,
    undoCount: 0,
    restartCount: 0,
    inputCount: 0,
    blockedCount: 0,
    history: [],
  };
}

/** 辺の橋を 1本 → 2本 → なし と回す。全部の島がちょうどでつながったら、その時刻でクリアにする。 */
export function cycleBridgesSessionEdge(
  session: BridgesSession,
  edge: number,
  operatedAt: number,
): BridgesSessionEdgeChange {
  if (session.status !== "playing") {
    return { session, crossingEdges: null };
  }

  const change = cycleBridgesEdge(session.problem, session.puzzleState, edge);
  if (change.kind === "blocked") {
    return {
      session: { ...session, blockedCount: session.blockedCount + 1 },
      crossingEdges: change.crossingEdges,
    };
  }

  const changed = {
    ...session,
    puzzleState: change.state,
    history: [...session.history, session.puzzleState],
    inputCount: session.inputCount + 1,
  };
  return {
    session: isBridgesSolved(session.problem, change.state)
      ? { ...changed, status: "cleared", finishedAt: operatedAt }
      : changed,
    crossingEdges: null,
  };
}

/** 直前の盤面操作を1つ取り消す（待った）。盤面を戻す前の操作は戻せない。 */
export function undoBridgesSession(session: BridgesSession): BridgesSession {
  if (!canUndoBridgesSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: session.history.at(-1)!,
    history: session.history.slice(0, -1),
    undoCount: session.undoCount + 1,
  };
}

export function canUndoBridgesSession(session: BridgesSession): boolean {
  return session.status === "playing" && session.history.length > 0;
}

/** 同じプレイのまま橋を全部外す（盤面を戻す）。経過時間は引き継ぎ、待ったの履歴は消す。 */
export function restartBridgesSession(session: BridgesSession): BridgesSession {
  if (!canRestartBridgesSession(session)) {
    return session;
  }

  return {
    ...session,
    puzzleState: createInitialBridgesState(session.problem),
    history: [],
    restartCount: session.restartCount + 1,
  };
}

/** 橋が1本でも架かっているプレイ中だけ、盤面を戻せる。 */
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
  };
}
