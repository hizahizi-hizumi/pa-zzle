import { getSessionElapsedMs } from "@/games/session";
import {
  getTakuzuSessionCorrectionCount,
  type TakuzuSession,
} from "@/games/takuzu/session/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

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
