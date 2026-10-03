import {
  getNanpureSessionElapsedMs,
  type NanpureSession,
} from "@/games/nanpure/session/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値は保存しない。 */
export function createNanpurePlayAttemptProgress(
  session: NanpureSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getNanpureSessionElapsedMs(session, abandonedAt),
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
