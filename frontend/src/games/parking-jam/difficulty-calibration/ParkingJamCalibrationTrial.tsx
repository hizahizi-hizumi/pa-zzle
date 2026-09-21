import { Button } from "@/components/ui/button";
import { ParkingJamBoard } from "@/games/parking-jam/ui/board/ParkingJamBoard";
import type { ParkingJamDifficultyCalibrationProblemId } from "../difficulty-calibration";
import type { ParkingJamCalibrationTrialResult } from "./results";
import { useParkingJamCalibrationTrial } from "./use-parking-jam-calibration-trial";

type ParkingJamCalibrationTrialProps = {
  label: string;
  problemId: ParkingJamDifficultyCalibrationProblemId;
  onComplete: (result: ParkingJamCalibrationTrialResult) => void;
};

export function ParkingJamCalibrationTrial({
  label,
  problemId,
  onComplete,
}: ParkingJamCalibrationTrialProps) {
  const trial = useParkingJamCalibrationTrial(problemId);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">難易度ラベル非表示</p>
          <h2 className="text-lg font-semibold">{label}</h2>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!trial.canUndo}
            onClick={trial.undo}
          >
            待った
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!trial.canRestart}
            onClick={trial.restart}
          >
            やり直し
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden sm:items-center">
        <ParkingJamBoard
          board={trial.board}
          state={trial.state}
          selectedVehicleId={trial.selectedVehicleId}
          operation={trial.operation}
          interactionDisabled={trial.result !== null}
          onSelectVehicle={trial.selectVehicle}
          onMove={trial.attemptMove}
          onExitAnimationComplete={trial.completeExitAnimation}
        />
      </div>

      {trial.cleared && trial.result ? (
        <div className="flex justify-end">
          <Button type="button" onClick={() => onComplete(trial.result!)}>
            次へ
          </Button>
        </div>
      ) : null}
    </section>
  );
}
