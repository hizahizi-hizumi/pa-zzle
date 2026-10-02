import { useMemo, useState } from "react";

import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { createParkingJamDiagnosticSnapshot } from "@/games/parking-jam/diagnostics";
import {
  getParkingJamDifficultyLabel,
  type ParkingJamDifficulty,
} from "@/games/parking-jam/difficulty";
import { useParkingJamPlay } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  createParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import type { ParkingJamRestoredProblem } from "@/games/parking-jam/problem/generator";
import { selectParkingJamProblemById } from "@/games/parking-jam/problem-selection";
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

/**
 * 最初に遊ぶ問題を指定する。指定した問題は URL の問題 ID とは結ばない。
 * - `replay`: 記録の問題を、その記録の難易度として遊び直す。記録は通常どおり保存する。
 * - `blind-comparison`: 人間の遊び比べ用に指定した問題。難易度を伏せ、記録を保存しない。
 */
type ParkingJamInitialProblem = {
  restored: ParkingJamRestoredProblem;
  purpose: "replay" | "blind-comparison";
};

type PlayableParkingJamProps = {
  difficulty: ParkingJamDifficulty;
  initialProblem?: ParkingJamInitialProblem;
};

const BLIND_COMPARISON_DIFFICULTY_LABEL = "問題指定";

export function PlayableParkingJam({
  difficulty,
  initialProblem,
}: PlayableParkingJamProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectParkingJamProblemById(difficulty, problemId),
  );
  const play = useParkingJamPlay(
    difficulty,
    initialProblem?.restored ?? requestedProblem,
  );
  useProblemIdQuerySync(initialProblem ? null : play.problemIdentity);
  const navigate = useNavigate();
  const isBlindComparison =
    initialProblem?.purpose === "blind-comparison" &&
    play.problemSource === "given";
  const playRecord = useMemo(
    () =>
      !isBlindComparison && play.result && play.completedAt !== null
        ? createParkingJamPlayRecord({
            difficulty,
            problemIdentity: play.problemIdentity,
            speedReference: play.result.speedReference,
            startedAt: play.startedAt,
            completedAt: play.completedAt,
            result: play.result,
          })
        : null,
    [
      difficulty,
      isBlindComparison,
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
  const diagnostics = useMemo(
    () =>
      internalDiagnosticsAvailable && diagnosticsOpen
        ? createParkingJamDiagnosticSnapshot({
            difficulty,
            problemIdentity: play.problemIdentity,
            buildRevision,
          })
        : null,
    [difficulty, diagnosticsOpen, play.problemIdentity],
  );

  return (
    <>
      <ParkingJamPlay
        difficultyLabel={
          isBlindComparison
            ? BLIND_COMPARISON_DIFFICULTY_LABEL
            : getParkingJamDifficultyLabel(difficulty)
        }
        status={play.status}
        progress={play.progress}
        board={play.board}
        state={play.state}
        selectedVehicleId={play.selectedVehicleId}
        operation={play.operation}
        elapsedMs={play.elapsedMs}
        failedMoveCount={play.failedMoveCount}
        undoCount={play.undoCount}
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
          internalDiagnosticsAvailable
            ? () => setDiagnosticsOpen(true)
            : undefined
        }
      />
      {diagnostics ? (
        <ParkingJamDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      ) : null}
    </>
  );
}
