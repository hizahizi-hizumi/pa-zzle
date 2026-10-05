import { type ReactNode, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { PlayHeader } from "@/components/PlayHeader";
import { UndoButton } from "@/components/UndoButton";
import type {
  ParkingJamOperation,
  ParkingJamResult,
} from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamDirection,
  ParkingJamState,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoard } from "@/games/parking-jam/ui/board/ParkingJamBoard";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";
import { ParkingJamResultScreen } from "@/games/parking-jam/ui/result/ParkingJamResultScreen";
import type { GameProgress } from "@/games/play";
import type { GameSessionStatus } from "@/games/session";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type ParkingJamPlayProps = {
  /** 結果画面に出す難易度の表示名。 */
  difficultyLabel: string;
  status: GameSessionStatus;
  progress: GameProgress;
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
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

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
        onOpenDiagnostics={onOpenDiagnostics}
      />
    );
  }

  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <PlayHeader
        title="パーキングジャム"
        metricGroups={[
          [
            { label: "ミス", value: String(failedMoveCount) },
            { label: "時間", value: formatElapsedTime(elapsedMs) },
            { label: "待った", value: String(undoCount) },
          ],
        ]}
        canRestart={canRestart}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={() => setHowToPlayOpen(true)}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <ParkingJamHowToPlayDialog
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
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
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        <div className="flex h-14 items-center justify-center">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
        </div>
      </footer>
    </section>
  );
}
