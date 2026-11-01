import { listHamiltonianPathOpenCells } from "@/games/hamiltonian-path/puzzle/board";
import type { HamiltonianPathSession } from "@/games/hamiltonian-path/session/session";
import { getSessionElapsedMs } from "@/games/session";
import type { PlayAttemptProgress } from "@/records/play-attempt";

/**
 * 離れた時点までの実測値。評価値は保存しない。
 * 道が通ったマスの数（始点を含む）と道が通るマスの数を並べ、どこまで引けていたかを残す。
 */
export function createHamiltonianPathPlayAttemptProgress(
  session: HamiltonianPathSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    visitedCellCount: session.puzzleState.path.length,
    openCellCount: listHamiltonianPathOpenCells(session.problem).length,
    backtrackCount: session.backtrackCount,
    retractedCellCount: session.retractedCellCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    inputCount: session.inputCount,
  } satisfies PlayAttemptProgress;
}
