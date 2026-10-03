import {
  getReflectionSessionElapsedMs,
  type ReflectionSession,
} from "@/games/reflection/session/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値は保存しない。 */
export function createReflectionPlayAttemptProgress(
  session: ReflectionSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getReflectionSessionElapsedMs(session, abandonedAt),
    relocationCount: session.relocationCount,
    restartCount: session.restartCount,
    laserCheckCount: session.laserCheckCount,
    inputCount: session.inputCount,
  } satisfies PlayAttemptProgress;
}
