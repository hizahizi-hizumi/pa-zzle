import { minesweeperCatalogEntry } from "@/game-catalog/minesweeper/minesweeper-catalog-entry";
import { usePlayableGame } from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { createMinesweeperDiagnosticSnapshot } from "@/games/minesweeper/diagnostics";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { useMinesweeperPlay } from "@/games/minesweeper/play/use-minesweeper-play";
import { createMinesweeperPlayAttemptProgress } from "@/games/minesweeper/play-attempt";
import {
  createMinesweeperPlayRecord,
  minesweeperPlayRecordDefinition,
} from "@/games/minesweeper/play-record";
import { selectMinesweeperProblemById } from "@/games/minesweeper/problem-selection";
import { MinesweeperDiagnostics } from "@/games/minesweeper/ui/MinesweeperDiagnostics";
import { MinesweeperPlay } from "@/games/minesweeper/ui/MinesweeperPlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableMinesweeperProps = {
  difficulty: MinesweeperDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableMinesweeper({
  difficulty,
  avoidedProblemId,
}: PlayableMinesweeperProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectMinesweeperProblemById(difficulty, problemId),
  );
  const play = useMinesweeperPlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: minesweeperCatalogEntry,
    play,
    playRecordDefinition: minesweeperPlayRecordDefinition,
    createPlayRecord: createMinesweeperPlayRecord,
    createPlayAttemptProgress: createMinesweeperPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createMinesweeperDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <MinesweeperPlay
        {...screenProps}
        rows={play.rows}
        columns={play.columns}
        mineCount={play.mineCount}
        flagCount={play.flagCount}
        mistakeCount={play.mistakeCount}
        visibleCells={play.visibleCells}
        onRevealCell={play.revealCell}
        onToggleFlag={play.toggleFlag}
        onChordCell={play.chordCell}
      />
      {diagnostics.snapshot && (
        <MinesweeperDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
