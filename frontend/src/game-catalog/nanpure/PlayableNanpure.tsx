import { nanpureCatalogEntry } from "@/game-catalog/nanpure/nanpure-catalog-entry";
import { usePlayableGame } from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
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
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableNanpure({
  difficulty,
  avoidedProblemId,
}: PlayableNanpureProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectNanpureProblemById(difficulty, problemId),
  );
  const play = useNanpurePlay(difficulty, requestedProblem, avoidedProblemId);
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
        onClearAnimationComplete={play.completeClearAnimation}
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
