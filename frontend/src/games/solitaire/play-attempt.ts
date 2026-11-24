import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import { getSessionElapsedMs } from "@/games/session";
import type { SolitaireSession } from "@/games/solitaire/session/session";

/** 評価値は保存しない。 */
export function createSolitairePlayAttemptProgress(
  session: SolitaireSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    retractedMoveCount: session.retractedMoveCount,
  } satisfies PlayAttemptProgress;
}
