import type { BridgesSession } from "@/games/bridges/session/session";
import { getSessionElapsedMs } from "@/games/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/**
 * 架けていた橋の本数と解に要る橋の本数を並べ、どこまで架けていたかを残す。
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
