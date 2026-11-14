import type { PlayAttemptProgress } from "@/features/records/play-attempt";
import { listHitofudePuzzleOpenCells } from "@/games/hitofude-puzzle/puzzle/board";
import type { HitofudePuzzleSession } from "@/games/hitofude-puzzle/session/session";
import { getSessionElapsedMs } from "@/games/session";

export function createHitofudePuzzlePlayAttemptProgress(
  session: HitofudePuzzleSession,
  abandonedAt: number,
) {
  return {
    elapsedMs: getSessionElapsedMs(session, abandonedAt),
    // 道が通ったマスの数（始点を含む）と道が通るマスの数を並べ、どこまで引けていたかを残す。
    visitedCellCount: session.puzzleState.path.length,
    openCellCount: listHitofudePuzzleOpenCells(session.problem).length,
    backtrackCount: session.backtrackCount,
    retractedCellCount: session.retractedCellCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    inputCount: session.inputCount,
  } satisfies PlayAttemptProgress;
}
