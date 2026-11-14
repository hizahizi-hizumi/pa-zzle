import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import { getSessionElapsedMs } from "@/games/session";
import type { WaterSortSession } from "@/games/water-sort/session/session";

export function createWaterSortPlayAttemptProgress(
  session: WaterSortSession,
  abandonedAt: number,
) {
  // クリアの評価にだけ使うクリアまでの手数・最短手数は保存しない。
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
