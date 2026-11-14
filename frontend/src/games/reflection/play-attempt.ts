import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import type { ReflectionSession } from "@/games/reflection/session/session";
import { getSessionElapsedMs } from "@/games/session";

export function createReflectionPlayAttemptProgress(
  session: ReflectionSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    relocationCount: session.relocationCount,
    restartCount: session.restartCount,
    laserCheckCount: session.laserCheckCount,
    inputCount: session.inputCount,
  } satisfies PlayAttemptProgress;
}
