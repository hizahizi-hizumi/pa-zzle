import type { IceFloorMazeSession } from "@/games/ice-floor-maze/session/session";
import { getSessionElapsedMs } from "@/games/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値と、クリアの評価にだけ使う最短手数は保存しない。 */
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
