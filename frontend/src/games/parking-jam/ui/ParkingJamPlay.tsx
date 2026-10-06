import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
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
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";

type ParkingJamPlayProps = GamePlayScreenProps<
  ParkingJamDifficulty,
  ParkingJamResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    board: ParkingJamBoardDefinition;
    state: ParkingJamState;
    selectedVehicleId: ParkingJamVehicleId | null;
    operation: ParkingJamOperation | null;
    failedMoveCount: number;
    undoCount: number;
    onSelectVehicle: (vehicleId: ParkingJamVehicleId) => void;
    onMove: (
      vehicleId: ParkingJamVehicleId,
      direction: ParkingJamDirection,
    ) => void;
    onClearAnimationComplete: () => void;
  };

export function ParkingJamPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  board,
  state,
  selectedVehicleId,
  operation,
  failedMoveCount,
  undoCount,
  canUndo,
  canRestart,
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
  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={PARKING_JAM_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "ミス", count: failedMoveCount },
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: "待った", count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <ParkingJamHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <ParkingJamResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordOutcomeNotice={recordOutcomeNotice}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenRecords={onOpenRecords}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-2 sm:px-6">
        <ParkingJamBoard
          board={board}
          state={state}
          selectedVehicleId={selectedVehicleId}
          operation={operation}
          interactionDisabled={progress !== "playing"}
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
    </GamePlayFrame>
  );
}
