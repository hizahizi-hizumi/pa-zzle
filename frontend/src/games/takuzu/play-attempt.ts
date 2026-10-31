import { getSessionElapsedMs } from "@/games/session";
import {
  getTakuzuSessionCorrectionCount,
  type TakuzuSession,
} from "@/games/takuzu/session/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値は保存しない。 */
export function createTakuzuPlayAttemptProgress(
  session: TakuzuSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    correctionCount: getTakuzuSessionCorrectionCount(session),
    restartCount: session.restartCount,
    undoCount: session.undoCount,
    inputCount: session.inputCount,
  } satisfies PlayAttemptProgress;
}
