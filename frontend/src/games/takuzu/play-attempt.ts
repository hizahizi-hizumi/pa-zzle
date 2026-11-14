import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import { getSessionElapsedMs } from "@/games/session";
import {
  getTakuzuSessionCorrectionCount,
  type TakuzuSession,
} from "@/games/takuzu/session/session";

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
