import { minesweeperCatalogEntry } from "@/app/game-integration/minesweeper/minesweeper-catalog-entry";
import { usePlayableGame } from "@/app/game-integration/playable-game";
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
  problemId: ProblemId;
};

export function PlayableMinesweeper({
  difficulty,
  problemId,
}: PlayableMinesweeperProps) {
  const requestedProblem = selectMinesweeperProblemById(difficulty, problemId);
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useMinesweeperPlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
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
        operation={play.operation}
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
