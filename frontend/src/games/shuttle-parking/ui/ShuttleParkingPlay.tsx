import { useEffect, useRef } from "react";
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
import { ShuttleParkingLot } from "@/games/shuttle-parking/ui/board/ShuttleParkingLot";
import { ShuttleParkingResultScreen } from "@/games/shuttle-parking/ui/result/ShuttleParkingResultScreen";
import { ShuttleParkingBays } from "@/games/shuttle-parking/ui/ShuttleParkingBays";
import { ShuttleParkingGround } from "@/games/shuttle-parking/ui/ShuttleParkingGround";
import { ShuttleParkingHowToPlayDialog } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog";
import { ShuttleParkingQueue } from "@/games/shuttle-parking/ui/ShuttleParkingQueue";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

type ShuttleParkingPlayProps = GamePlayScreenProps<
  ShuttleParkingDifficulty,
  ShuttleParkingResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    problem: ShuttleParkingProblem;
    state: ShuttleParkingState;
    operation: ShuttleParkingOperation | null;
    undoCount: number;
    onExitCar: (carId: ShuttleParkingCarId) => void;
  };

const clearPulseMs = 480;
const clearHoldMs = 240;

export function ShuttleParkingPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  problem,
  state,
  operation,
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
  const lotAreaRef = useRef<HTMLDivElement>(null);
  const clearing = progress === "clearing";

  useEffect(() => {
    if (!clearing) return;
    return playAnimations({
      animate() {
        const animation = lotAreaRef.current?.animate?.(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.03)" },
            { transform: "scale(1)" },
          ],
          { duration: clearPulseMs, easing: MOTION_EASING.celebrate },
        );
        return animation ? [animation] : [];
      },
      completion: { type: "after-animations", holdMs: clearHoldMs },
      reducedMotionHoldMs: clearHoldMs,
      unanimatedHoldMs: clearHoldMs,
      onFinished: onClearAnimationComplete,
    });
  }, [clearing, onClearAnimationComplete]);

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
      renderHowToPlayDialog={({ open, onClose }) => (
        <ShuttleParkingHowToPlayDialog open={open} onClose={onClose} />
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
      <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-3 overflow-hidden px-4 pt-2 pb-4">
        <ShuttleParkingQueue
          passengers={problem.passengers}
          boardedCount={state.boardedCount}
        />
        <div className="flex items-center gap-3">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
          <ShuttleParkingBays
            cars={problem.lot.cars}
            bayCount={problem.bayCount}
            waitingCars={state.waitingCars}
          />
        </div>
        <div
          className="flex min-h-0 flex-1 items-start justify-center"
          style={{ containerType: "size" }}
        >
          <div ref={lotAreaRef} style={{ width: "min(100cqw, 100cqh)" }}>
            <ShuttleParkingLot
              lot={problem.lot}
              parkedCarIds={state.parkedCarIds}
              operation={operation}
              interactionDisabled={progress !== "playing"}
              onExitCar={onExitCar}
            />
          </div>
        </div>
      </main>
    </GamePlayFrame>
  );
}
