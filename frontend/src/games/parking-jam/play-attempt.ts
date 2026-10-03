import {
  getParkingJamSessionElapsedMs,
  type ParkingJamSession,
} from "@/games/parking-jam/session/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値は保存しない。 */
export function createParkingJamPlayAttemptProgress(
  session: ParkingJamSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getParkingJamSessionElapsedMs(session, abandonedAt),
    moveAttemptCount: session.moveAttemptCount,
    successfulMoveCount: session.successfulMoveCount,
    failedMoveCount: session.failedMoveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
