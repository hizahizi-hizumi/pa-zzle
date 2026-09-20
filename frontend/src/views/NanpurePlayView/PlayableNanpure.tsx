import { useMemo, useState } from "react";

import { createNanpureDiagnosticSnapshot } from "@/games/nanpure/diagnostics";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { useNanpurePlay } from "@/games/nanpure/play/use-nanpure-play";
import {
  createNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import { NanpureDiagnostics } from "@/games/nanpure/ui/NanpureDiagnostics";
import { NanpurePlay } from "@/games/nanpure/ui/NanpurePlay";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
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
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createNanpureDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
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
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={nanpurePlayRecordDisplay}
          />
        }
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
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && diagnosticsOpen && (
        <NanpureDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
