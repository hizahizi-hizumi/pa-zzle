import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import { getSessionElapsedMs } from "@/games/session";
import type { SlidePuzzleSession } from "@/games/slide-puzzle/session/session";

/** クリアの評価にだけ使う、最後に盤面を戻してからの手数と最短手数は保存しない。 */
export function createSlidePuzzlePlayAttemptProgress(
  session: SlidePuzzleSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    slideCount: session.slideCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
