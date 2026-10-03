import {
  getSlidePuzzleSessionElapsedMs,
  type SlidePuzzleSession,
} from "@/games/slide-puzzle/session/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値と、クリアの評価にだけ使う最後に盤面を戻してからの手数・最短手数は保存しない。 */
export function createSlidePuzzlePlayAttemptProgress(
  session: SlidePuzzleSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSlidePuzzleSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    slideCount: session.slideCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
