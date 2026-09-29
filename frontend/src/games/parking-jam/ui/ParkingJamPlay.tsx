import type { ReactNode } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { UndoButton } from "@/components/UndoButton";
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
  /** 結果画面に出す難易度の表示名。 */
  difficultyLabel: string;
  status: "playing" | "cleared";
  progress: ParkingJamProgress;
  board: ParkingJamBoardDefinition;
  state: ParkingJamState;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  elapsedMs: number;
  failedMoveCount: number;
  undoCount: number;
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
  onOpenDiagnostics?: () => void;
};

export function ParkingJamPlay({
  difficultyLabel,
  status,
  progress,
  board,
  state,
  selectedVehicleId,
  operation,
  elapsedMs,
  failedMoveCount,
  undoCount,
  canUndo,
  canRestart,
  result,
  recordOutcomeNotice,
  onSelectVehicle,
  onMove,
  onUndo,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onClearAnimationComplete,
  onOpenDiagnostics,
}: ParkingJamPlayProps) {
  if (progress === "result" && result) {
    return (
      <ParkingJamResultScreen
        difficultyLabel={difficultyLabel}
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
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <ParkingJamPlayHeader
        elapsedMs={elapsedMs}
        failedMoveCount={failedMoveCount}
        undoCount={undoCount}
        canRestart={canRestart}
        onRestart={onRestart}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-2 sm:px-6">
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
      <footer className="flex h-20 shrink-0 items-center justify-center">
        <UndoButton
          disabled={!canUndo || status !== "playing"}
          onUndo={onUndo}
        />
      </footer>
    </section>
  );
}
