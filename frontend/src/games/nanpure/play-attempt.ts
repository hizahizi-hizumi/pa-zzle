import type { NanpureSession } from "@/games/nanpure/session/session";
import { getSessionElapsedMs } from "@/games/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

export function createNanpurePlayAttemptProgress(
  session: NanpureSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    mistakeCount: session.mistakeCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
