import type { ReactNode } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { getParkingJamDifficultyLabel } from "@/games/parking-jam/difficulty";
import type {
  ParkingJamOperation,
  ParkingJamProgress,
  ParkingJamResult,
} from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamDirection,
  ParkingJamState,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoard } from "@/games/parking-jam/ui/board/ParkingJamBoard";
import { ParkingJamDirectionControls } from "@/games/parking-jam/ui/ParkingJamPlay/ParkingJamDirectionControls";
import { ParkingJamPlayHeader } from "@/games/parking-jam/ui/ParkingJamPlay/ParkingJamPlayHeader";
import { ParkingJamResultScreen } from "@/games/parking-jam/ui/ParkingJamPlay/ParkingJamResultScreen";

type ParkingJamPlayProps = {
  difficulty: ParkingJamDifficulty;
  status: "playing" | "cleared";
  progress: ParkingJamProgress;
  board: ParkingJamBoardDefinition;
  state: ParkingJamState;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  elapsedMs: number;
  failedMoveCount: number;
  canUndo: boolean;
  canRestart: boolean;
  result: ParkingJamResult | null;
  recordOutcomeNotice: ReactNode;
  onSelectVehicle: (vehicleId: ParkingJamVehicleId) => void;
  onDirection: (direction: ParkingJamDirection) => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onClearAnimationComplete: () => void;
};

export function ParkingJamPlay({
  difficulty,
  status,
  progress,
  board,
  state,
  selectedVehicleId,
  operation,
  elapsedMs,
  failedMoveCount,
  canUndo,
  canRestart,
  result,
  recordOutcomeNotice,
  onSelectVehicle,
  onDirection,
  onUndo,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onClearAnimationComplete,
}: ParkingJamPlayProps) {
  if (progress === "result" && result) {
    return (
      <ParkingJamResultScreen
        difficulty={difficulty}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onOpenRecords={onOpenRecords}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />
    );
  }

  const selectedVehicle = board.vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );
  const feedback = operation?.type ?? null;
  const playing = status === "playing";

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <ParkingJamPlayHeader
        elapsedMs={elapsedMs}
        failedMoveCount={failedMoveCount}
        canUndo={canUndo}
        canRestart={canRestart}
        playing={playing}
        onUndo={onUndo}
        onRestart={onRestart}
      />

      <main className="flex min-h-0 flex-1 items-center justify-center px-1 py-1 sm:px-6 sm:py-3">
        <div className="flex w-full max-w-lg flex-col items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {getParkingJamDifficultyLabel(difficulty)}
          </span>
          <ParkingJamBoard
            board={board}
            state={state}
            selectedVehicleId={selectedVehicleId}
            operation={operation}
            interactionDisabled={!playing}
            onSelectVehicle={onSelectVehicle}
            onExitAnimationComplete={onClearAnimationComplete}
          />
        </div>
      </main>

      <footer className="h-28 shrink-0 px-4 pb-2">
        {playing && (
          <ParkingJamDirectionControls
            orientation={selectedVehicle?.orientation ?? null}
            feedback={feedback}
            disabled={!selectedVehicle}
            onDirection={onDirection}
          />
        )}
      </footer>
    </section>
  );
}
