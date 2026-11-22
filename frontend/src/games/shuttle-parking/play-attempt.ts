import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import { getSessionElapsedMs } from "@/games/session";
import type { ShuttleParkingSession } from "@/games/shuttle-parking/session/session";

/** 離れた時点までの実測値。評価値は保存しない。 */
export function createShuttleParkingPlayAttemptProgress(
  session: ShuttleParkingSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    boardedCount: session.puzzleState.boardedCount,
    exitCount: session.exitCount,
    blockedExitCount: session.blockedExitCount,
    trapCount: session.trapCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
