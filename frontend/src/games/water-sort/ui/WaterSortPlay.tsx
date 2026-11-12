import { useState } from "react";
import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { WATER_SORT_DISPLAY_NAME } from "@/games/water-sort/display-name";
import type {
  WaterSortOperation,
  WaterSortResult,
} from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";
import { DeadlockNotice } from "@/games/water-sort/ui/DeadlockNotice";
import { WaterSortResultScreen } from "@/games/water-sort/ui/result/WaterSortResultScreen";
import { useWaterSortSoundEffects } from "@/games/water-sort/ui/use-water-sort-sound-effects";
import { WaterSortGround } from "@/games/water-sort/ui/WaterSortGround";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { WaterSortTutorial } from "@/games/water-sort/ui/WaterSortTutorial";
import { cn } from "@/lib/utils";

type WaterSortPlayProps = GamePlayScreenProps<
  WaterSortDifficulty,
  WaterSortResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    state: WaterSortState;
    moveCount: number;
    undoCount: number;
    isDeadlocked: boolean;
    sourceBottleIndex: number | null;
    operation: WaterSortOperation | null;
    onSelectBottle: (bottleIndex: number) => void;
  };

export function WaterSortPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  state,
  moveCount,
  undoCount,
  canUndo,
  isDeadlocked,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onClearAnimationComplete,
  onOpenGameHome,
  onBackToAppHome,
  onOpenDiagnostics,
}: WaterSortPlayProps) {
  const [hasActivePourAnimation, setHasActivePourAnimation] = useState(false);
  const showDeadlockNotice = isDeadlocked && !hasActivePourAnimation;
  useWaterSortSoundEffects(operation, progress);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={WATER_SORT_DISPLAY_NAME}
      background={<WaterSortGround />}
      metrics={[
        { type: "count", label: "手数", count: moveCount },
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: PLAY_OPERATION_LABELS.undo, count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToAppHome={onBackToAppHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <WaterSortHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose }) => (
        <WaterSortTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <WaterSortResultScreen
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
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        <WaterSortBoard
          state={state}
          sourceBottleIndex={sourceBottleIndex}
          operation={operation}
          onSelectBottle={onSelectBottle}
          interactionDisabled={progress !== "playing"}
          onPourAnimationActivityChange={setHasActivePourAnimation}
          onClearAnimationComplete={onClearAnimationComplete}
        />
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        {showDeadlockNotice ? (
          <DeadlockNotice
            canUndo={canUndo}
            onUndo={onUndo}
            onRestart={onRestart}
          />
        ) : (
          <div className="flex h-14 items-center justify-center">
            <UndoButton disabled={!canUndo} onUndo={onUndo} />
          </div>
        )}
      </footer>
    </GamePlayFrame>
  );
}
