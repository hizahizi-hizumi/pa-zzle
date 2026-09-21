import { useMemo, useState } from "react";

import { createParkingJamDiagnosticSnapshot } from "@/games/parking-jam/diagnostics";
import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { useParkingJamPlay } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  createParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import { ParkingJamDiagnostics } from "@/games/parking-jam/ui/ParkingJamDiagnostics";
import { ParkingJamPlay } from "@/games/parking-jam/ui/ParkingJamPlay";
import { parkingJamPlayRecordDisplay } from "@/games/parking-jam/ui/play-record-display";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableParkingJamProps = {
  difficulty: ParkingJamDifficulty;
};

export function PlayableParkingJam({ difficulty }: PlayableParkingJamProps) {
  const play = useParkingJamPlay(difficulty);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createParkingJamPlayRecord({
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
    parkingJamPlayRecordDefinition,
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createParkingJamDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        difficultyAnalysis: play.difficultyAnalysis,
        buildRevision,
      })
    : null;

  return (
    <>
      <ParkingJamPlay
        difficulty={play.difficulty}
        status={play.status}
        progress={play.progress}
        board={play.board}
        state={play.state}
        selectedVehicleId={play.selectedVehicleId}
        operation={play.operation}
        elapsedMs={play.elapsedMs}
        failedMoveCount={play.failedMoveCount}
        canUndo={play.canUndo}
        canRestart={play.canRestart}
        result={play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={parkingJamPlayRecordDisplay}
          />
        }
        onSelectVehicle={play.selectVehicle}
        onMove={play.attemptMove}
        onUndo={play.undo}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onChangeDifficulty={() => navigate("/puzzles/parking-jam")}
          onBackToHome={() => navigate("/")}
          onClearAnimationComplete={play.completeClearAnimation}
          onOpenDiagnostics={
            diagnostics ? () => setDiagnosticsOpen(true) : undefined
          }
        />
      {diagnostics && diagnosticsOpen ? (
        <ParkingJamDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      ) : null}
    </>
  );
}
