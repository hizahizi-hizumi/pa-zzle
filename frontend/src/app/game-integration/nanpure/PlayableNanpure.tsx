import { nanpureCatalogEntry } from "@/app/game-integration/nanpure/nanpure-catalog-entry";
import { usePlayableGame } from "@/app/game-integration/playable-game";
import { createNanpureDiagnosticSnapshot } from "@/games/nanpure/diagnostics";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { useNanpurePlay } from "@/games/nanpure/play/use-nanpure-play";
import { createNanpurePlayAttemptProgress } from "@/games/nanpure/play-attempt";
import {
  createNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import { selectNanpureProblemById } from "@/games/nanpure/problem-selection";
import { NanpureDiagnostics } from "@/games/nanpure/ui/NanpureDiagnostics";
import { NanpurePlay } from "@/games/nanpure/ui/NanpurePlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableNanpureProps = {
  difficulty: NanpureDifficulty;
  problemId: ProblemId;
};

export function PlayableNanpure({
  difficulty,
  problemId,
}: PlayableNanpureProps) {
  const requestedProblem = selectNanpureProblemById(difficulty, problemId);
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useNanpurePlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: nanpureCatalogEntry,
    play,
    playRecordDefinition: nanpurePlayRecordDefinition,
    createPlayRecord: createNanpurePlayRecord,
    createPlayAttemptProgress: createNanpurePlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createNanpureDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <NanpurePlay
        {...screenProps}
        clues={play.clues}
        board={play.board}
        notes={play.notes}
        selectedCellIndex={play.selectedCellIndex}
        conflictCellIndices={play.conflictCellIndices}
        mistakeCellIndices={play.mistakeCellIndices}
        completedDigits={play.completedDigits}
        notesMode={play.notesMode}
        operation={play.operation}
        mistakeCount={play.mistakeCount}
        undoCount={play.undoCount}
        canUndo={play.canUndo}
        onSelectCell={play.selectCell}
        onInputDigit={play.inputDigit}
        onErase={play.erase}
        onToggleNotesMode={play.toggleNotesMode}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <NanpureDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
