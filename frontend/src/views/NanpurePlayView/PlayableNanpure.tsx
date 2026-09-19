import { useMemo } from "react";

import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { useNanpurePlay } from "@/games/nanpure/play/use-nanpure-play";
import {
  createNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import { NanpurePlay } from "@/games/nanpure/ui/NanpurePlay";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { useNavigate } from "@/router";

type PlayableNanpureProps = {
  difficulty: NanpureDifficulty;
};

export function PlayableNanpure({ difficulty }: PlayableNanpureProps) {
  const play = useNanpurePlay(difficulty);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createNanpurePlayRecord({
            difficulty,
            problemIdentity: play.problemIdentity,
            startedAt: play.startedAt,
            completedAt: play.completedAt,
            result: play.result,
          })
        : null,
    [
      difficulty,
      play.completedAt,
      play.problemIdentity,
      play.result,
      play.startedAt,
    ],
  );
  const recordOutcome = useSavePlayRecord(
    playRecord,
    nanpurePlayRecordDefinition,
  );

  return (
    <NanpurePlay
      difficulty={difficulty}
      status={play.status}
      progress={play.progress}
      clues={play.clues}
      board={play.board}
      notes={play.notes}
      selectedCellIndex={play.selectedCellIndex}
      conflictCellIndices={play.conflictCellIndices}
      mistakeCellIndices={play.mistakeCellIndices}
      completedDigits={play.completedDigits}
      notesMode={play.notesMode}
      elapsedMs={play.elapsedMs}
      mistakeCount={play.mistakeCount}
      undoCount={play.undoCount}
      canUndo={play.canUndo}
      result={play.result}
      recordOutcome={recordOutcome}
      onSelectCell={play.selectCell}
      onInputDigit={play.inputDigit}
      onErase={play.erase}
      onToggleNotesMode={play.toggleNotesMode}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onStartNewProblem={play.startNewProblem}
      onOpenRecords={() => navigate("/records")}
      onChangeDifficulty={() => navigate("/puzzles/nanpure")}
      onBackToHome={() => navigate("/")}
      onClearAnimationComplete={play.completeClearAnimation}
    />
  );
}
