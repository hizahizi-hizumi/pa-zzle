import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import type { IceFloorMazeSession } from "@/games/ice-floor-maze/session/session";
import { getSessionElapsedMs } from "@/games/session";

/** 評価値と、クリアの評価にだけ使う最短手数は保存しない。 */
export function createIceFloorMazePlayAttemptProgress(
  session: IceFloorMazeSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
