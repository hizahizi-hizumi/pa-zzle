import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { useParkingJamPlay } from "@/games/parking-jam/play/use-parking-jam-play";
import { ParkingJamPlay } from "@/games/parking-jam/ui/ParkingJamPlay";

type PlayableParkingJamProps = {
  difficulty: ParkingJamDifficulty;
};

export function PlayableParkingJam({ difficulty }: PlayableParkingJamProps) {
  const play = useParkingJamPlay(difficulty);

  return (
    <ParkingJamPlay
      difficulty={play.difficulty}
      status={play.status}
      board={play.board}
      state={play.state}
      selectedVehicleId={play.selectedVehicleId}
      operation={play.operation}
      elapsedMs={play.elapsedMs}
      failedMoveCount={play.failedMoveCount}
      canUndo={play.canUndo}
      canRestart={play.canRestart}
      onSelectVehicle={play.selectVehicle}
      onDirection={play.attemptDirection}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onStartNewProblem={play.startNewProblem}
    />
  );
}
