import { getSessionElapsedMs } from "@/games/session";
import type { TsumeShogiSession } from "@/games/tsume-shogi/session/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値は保存しない。 */
export function createTsumeShogiPlayAttemptProgress(
  session: TsumeShogiSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    wrongCheckCount: session.wrongCheckCount,
    refutationViewCount: session.refutationViewCount,
    returnCount: session.returnCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    illegalInputCount: session.illegalInputCount,
    inputCount: session.inputCount,
  } satisfies PlayAttemptProgress;
}
