import { useMemo, useState } from "react";

import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { useRecordResultNavigation } from "@/game-catalog/record-result-navigation";
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
import type { ProblemId } from "@/games/problem-id";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableParkingJamProps = {
  difficulty: ParkingJamDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
  /**
   * 人間の遊び比べ用に指定した問題。最初の1問だけこの問題を出し、難易度を伏せて記録を保存しない。
   * URL の問題 ID とは結ばない。
   */
  blindComparisonProblem?: ParkingJamRestoredProblem;
};

const BLIND_COMPARISON_DIFFICULTY_LABEL = "問題指定";

export function PlayableParkingJam({
  difficulty,
  avoidedProblemId,
  blindComparisonProblem,
}: PlayableParkingJamProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectParkingJamProblemById(difficulty, problemId),
  );
  const play = useParkingJamPlay(
    difficulty,
    blindComparisonProblem ?? requestedProblem,
    avoidedProblemId,
  );
  useProblemIdQuerySync(blindComparisonProblem ? null : play.problemIdentity);
  const navigate = useNavigate();
  const isBlindComparison =
    blindComparisonProblem !== undefined && play.problemSource === "given";
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
  const navigatesToRecordResult = useRecordResultNavigation(
    play.progress === "result",
    playRecord,
    recordOutcome,
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
        // 記録の結果画面へ遷移する間は、その場の結果画面を出さず盤面を見せておく。
        result={navigatesToRecordResult ? null : play.result}
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
