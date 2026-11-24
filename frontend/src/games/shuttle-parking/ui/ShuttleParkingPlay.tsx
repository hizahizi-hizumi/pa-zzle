import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import type {
  ShuttleParkingOperation,
  ShuttleParkingResult,
} from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import type { ShuttleParkingCarId } from "@/games/shuttle-parking/puzzle/lot";
import type { ShuttleParkingState } from "@/games/shuttle-parking/puzzle/rules";
import { ShuttleParkingScene } from "@/games/shuttle-parking/ui/board/ShuttleParkingScene";
import { ShuttleParkingResultScreen } from "@/games/shuttle-parking/ui/result/ShuttleParkingResultScreen";
import { ShuttleParkingGround } from "@/games/shuttle-parking/ui/ShuttleParkingGround";
import { ShuttleParkingHowToPlayDialog } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog";
import { ShuttleParkingStuckNotice } from "@/games/shuttle-parking/ui/ShuttleParkingStuckNotice";
import { ShuttleParkingTutorial } from "@/games/shuttle-parking/ui/ShuttleParkingTutorial";
import { useShuttleParkingSoundEffects } from "@/games/shuttle-parking/ui/use-shuttle-parking-sound-effects";

type ShuttleParkingPlayProps = GamePlayScreenProps<
  ShuttleParkingDifficulty,
  ShuttleParkingResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    problem: ShuttleParkingProblem;
    state: ShuttleParkingState;
    operation: ShuttleParkingOperation | null;
    isStuck: boolean;
    undoCount: number;
    onExitCar: (carId: ShuttleParkingCarId) => void;
  };

export function ShuttleParkingPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  problem,
  state,
  operation,
  isStuck,
  undoCount,
  canUndo,
  canRestart,
  onExitCar,
  onUndo,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToAppHome,
  onOpenHowToPlay,
  onOpenTutorial,
  onClearAnimationComplete,
  onOpenDiagnostics,
  renderSettingsDialog,
}: ShuttleParkingPlayProps) {
  useShuttleParkingSoundEffects(operation, progress);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={SHUTTLE_PARKING_DISPLAY_NAME}
      background={<ShuttleParkingGround />}
      metrics={[
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: PLAY_OPERATION_LABELS.undo, count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToAppHome={onBackToAppHome}
      onOpenHowToPlay={onOpenHowToPlay}
      onOpenTutorial={onOpenTutorial}
      onOpenDiagnostics={onOpenDiagnostics}
      renderSettingsDialog={renderSettingsDialog}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <ShuttleParkingHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose }) => (
        <ShuttleParkingTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <ShuttleParkingResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordFeedback={recordFeedback}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pt-2 pb-4">
        <ShuttleParkingScene
          problem={problem}
          state={state}
          operation={operation}
          interactionDisabled={progress !== "playing"}
          onExitCar={onExitCar}
          leadingAction={<UndoButton disabled={!canUndo} onUndo={onUndo} />}
          renderLotNotice={
            isStuck && progress === "playing"
              ? () => (
                  <ShuttleParkingStuckNotice
                    canUndo={canUndo}
                    onUndo={onUndo}
                    onRestart={onRestart}
                  />
                )
              : undefined
          }
          clearing={progress === "clearing"}
          onClearAnimationComplete={onClearAnimationComplete}
        />
      </main>
    </GamePlayFrame>
  );
}
