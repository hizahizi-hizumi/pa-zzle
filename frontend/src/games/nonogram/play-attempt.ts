import {
  getNonogramSessionCrossToggleCount,
  getNonogramSessionRepaintCount,
  type NonogramSession,
} from "@/games/nonogram/session/session";
import { getSessionElapsedMs } from "@/games/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値は保存しない。 */
export function createNonogramPlayAttemptProgress(
  session: NonogramSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    repaintCount: getNonogramSessionRepaintCount(session),
    crossToggleCount: getNonogramSessionCrossToggleCount(session),
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    inputCount: session.inputCount,
  } satisfies PlayAttemptProgress;
}
