import { useMemo, useState } from "react";

import { createTakuzuDiagnosticSnapshot } from "@/games/takuzu/diagnostics";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { useTakuzuPlay } from "@/games/takuzu/play/use-takuzu-play";
import {
  createTakuzuPlayRecord,
  takuzuPlayRecordDefinition,
} from "@/games/takuzu/play-record";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import { TakuzuDiagnostics } from "@/games/takuzu/ui/TakuzuDiagnostics";
import { TakuzuPlay } from "@/games/takuzu/ui/TakuzuPlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableTakuzuProps = {
  difficulty: TakuzuDifficulty;
};

export function PlayableTakuzu({ difficulty }: PlayableTakuzuProps) {
  const play = useTakuzuPlay(difficulty);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createTakuzuPlayRecord({
            difficulty,
            problemIdentity: play.problemIdentity,
            workload: play.workload,
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
      play.workload,
    ],
  );
  const recordOutcome = useSavePlayRecord(
    playRecord,
    takuzuPlayRecordDefinition,
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createTakuzuDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <TakuzuPlay
        difficulty={play.difficulty}
        size={play.size}
        cells={play.cells}
        lineViolations={play.lineViolations}
        progress={play.progress}
        correctionCount={play.correctionCount}
        undoCount={play.undoCount}
        canUndo={play.canUndo}
        elapsedMs={play.elapsedMs}
        result={play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={takuzuPlayRecordDisplay}
          />
        }
        onCycleCell={play.cycleCell}
        onPlaceCell={play.placeCell}
        onUndo={play.undo}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onClearAnimationComplete={play.completeClearAnimation}
        onChangeDifficulty={() => navigate("/puzzles/takuzu")}
        onBackToHome={() => navigate("/")}
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && diagnosticsOpen && (
        <TakuzuDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
