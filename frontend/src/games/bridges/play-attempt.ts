import type { BridgesSession } from "@/games/bridges/session/session";
import { getSessionElapsedMs } from "@/games/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/**
 * 離れた時点までの実測値。評価値は保存しない。
 * 架けていた橋の本数（2本の組は2と数える）と、解に要る橋の本数（島の数字の合計の半分）を並べ、どこまで架けていたかを残す。
 * 架けた本数は解と照らさない数なので、正しい橋かどうかは表さない。
 */
export function createBridgesPlayAttemptProgress(
  session: BridgesSession,
  abandonedAt: number,
) {
  const { problem, puzzleState } = session;
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    placedBridgeCount: puzzleState.bridges.reduce<number>(
      (total, count) => total + count,
      0,
    ),
    requiredBridgeCount:
      problem.islands.reduce((total, { clue }) => total + clue, 0) / 2,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    inputCount: session.inputCount,
    blockedCount: session.blockedCount,
  } satisfies PlayAttemptProgress;
}
