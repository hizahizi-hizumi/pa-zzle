import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import type { FukumenzanSession } from "@/games/fukumenzan/session/session";
import { getSessionElapsedMs } from "@/games/session";

/**
 * 札を入れていた文字の数と式の文字の数を並べ、どこまで埋めていたかを残す。
 * 入れた札は解と照らさない数なので、正しい数字かどうかは表さない。
 */
export function createFukumenzanPlayAttemptProgress(
  session: FukumenzanSession,
  abandonedAt: number,
) {
  const { placedDigits } = session.puzzleState;
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    placedLetterCount: placedDigits.filter((digit) => digit !== null).length,
    letterCount: placedDigits.length,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    placeCount: session.placeCount,
    returnCount: session.returnCount,
    crossToggleCount: session.crossToggleCount,
  } satisfies PlayAttemptProgress;
}
