import type { MinesweeperSession } from "@/games/minesweeper/session/session";
import { getSessionElapsedMs } from "@/games/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/** 離れた時点までの実測値。評価値と、クリアの評価にだけ使う最小の開く回数は保存しない。 */
export function createMinesweeperPlayAttemptProgress(
  session: MinesweeperSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    mistakeCount: session.mistakeCount,
  } satisfies PlayAttemptProgress;
}
