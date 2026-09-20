import { useMemo } from "react";

import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { useParkingJamPlay } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  createParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import { ParkingJamPlay } from "@/games/parking-jam/ui/ParkingJamPlay";
import { parkingJamPlayRecordDisplay } from "@/games/parking-jam/ui/play-record-display";
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

  return (
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
      onDirection={play.attemptDirection}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onStartNewProblem={play.startNewProblem}
      onOpenRecords={() => navigate("/records")}
      onChangeDifficulty={() => navigate("/puzzles/parking-jam")}
      onBackToHome={() => navigate("/")}
      onClearAnimationComplete={play.completeClearAnimation}
    />
  );
}
