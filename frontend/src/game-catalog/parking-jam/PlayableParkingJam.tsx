import { parkingJamCatalogEntry } from "@/game-catalog/parking-jam/parking-jam-catalog-entry";
import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { createParkingJamDiagnosticSnapshot } from "@/games/parking-jam/diagnostics";
import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import {
  type ParkingJamResult,
  useParkingJamPlay,
} from "@/games/parking-jam/play/use-parking-jam-play";
import { createParkingJamPlayAttemptProgress } from "@/games/parking-jam/play-attempt";
import {
  createParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import { selectParkingJamProblemById } from "@/games/parking-jam/problem-selection";
import { ParkingJamDiagnostics } from "@/games/parking-jam/ui/ParkingJamDiagnostics";
import { ParkingJamPlay } from "@/games/parking-jam/ui/ParkingJamPlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableParkingJamProps = {
  difficulty: ParkingJamDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    ParkingJamDifficulty,
    ParkingJamProblemIdentity,
    ParkingJamResult
  >,
) {
  return createParkingJamPlayRecord({
    ...completed,
    speedReference: completed.result.speedReference,
  });
}

export function PlayableParkingJam({
  difficulty,
  avoidedProblemId,
}: PlayableParkingJamProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectParkingJamProblemById(difficulty, problemId),
  );
  const play = useParkingJamPlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: parkingJamCatalogEntry,
    play,
    playRecordDefinition: parkingJamPlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createParkingJamPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createParkingJamDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <ParkingJamPlay
        {...screenProps}
        board={play.board}
        state={play.state}
        selectedVehicleId={play.selectedVehicleId}
        operation={play.operation}
        failedMoveCount={play.failedMoveCount}
        undoCount={play.undoCount}
        canUndo={play.canUndo}
        canRestart={play.canRestart}
        onSelectVehicle={play.selectVehicle}
        onMove={play.attemptMove}
        onUndo={play.undo}
        onRestart={play.restart}
        onClearAnimationComplete={play.completeClearAnimation}
      />
      {diagnostics.snapshot && (
        <ParkingJamDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
