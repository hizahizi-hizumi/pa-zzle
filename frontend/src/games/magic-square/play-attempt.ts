import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import {
  getMagicSquareSessionCorrectionCount,
  type MagicSquareSession,
} from "@/games/magic-square/session/session";
import { getSessionElapsedMs } from "@/games/session";

/** 評価値と、評価にだけ使う問題の作業の量は保存しない。 */
export function createMagicSquarePlayAttemptProgress(
  session: MagicSquareSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    correctionCount: getMagicSquareSessionCorrectionCount(session),
    undoCount: session.undoCount,
    restartCount: session.restartCount,
  } satisfies PlayAttemptProgress;
}
