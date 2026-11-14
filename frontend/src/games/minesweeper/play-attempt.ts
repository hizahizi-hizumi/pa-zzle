import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import type { MinesweeperSession } from "@/games/minesweeper/session/session";
import { getSessionElapsedMs } from "@/games/session";

/** クリアの評価にだけ使う最小の開く回数は保存しない。 */
export function createMinesweeperPlayAttemptProgress(
  session: MinesweeperSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    mistakeCount: session.mistakeCount,
  } satisfies PlayAttemptProgress;
}
