import type { ReactNode } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
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
  onMove: (
    vehicleId: ParkingJamVehicleId,
    direction: ParkingJamDirection,
  ) => void;
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
  result,
  recordOutcomeNotice,
  onSelectVehicle,
  onMove,
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

  return (
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <ParkingJamPlayHeader
        elapsedMs={elapsedMs}
        failedMoveCount={failedMoveCount}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />
      <main className="flex min-h-0 flex-1 items-start justify-center overflow-hidden px-3 pt-3 sm:items-center sm:px-6 sm:py-4">
        <ParkingJamBoard
          board={board}
          state={state}
          selectedVehicleId={selectedVehicleId}
          operation={operation}
          interactionDisabled={status !== "playing"}
          onSelectVehicle={onSelectVehicle}
          onMove={onMove}
          onExitAnimationComplete={onClearAnimationComplete}
        />
      </main>
    </section>
  );
}
