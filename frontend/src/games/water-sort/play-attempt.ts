import {
  getWaterSortSessionElapsedMs,
  type WaterSortSession,
} from "@/games/water-sort/session/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値と、クリアの評価にだけ使うクリアまでの手数・最短手数は保存しない。 */
export function createWaterSortPlayAttemptProgress(
  session: WaterSortSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getWaterSortSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
