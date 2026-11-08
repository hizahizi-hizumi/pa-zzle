import { useState } from "react";
import { useSearchParams } from "react-router";
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
  WaterSortPourGesture,
  WaterSortResult,
} from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";
import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import { WaterSortResultScreen } from "@/games/water-sort/ui/result/WaterSortResultScreen";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { DeadlockNotice } from "@/games/water-sort/ui/WaterSortPlay/DeadlockNotice";
import { useWaterSortSoundEffects } from "@/games/water-sort/ui/WaterSortPlay/use-water-sort-sound-effects";
import { WaterSortLabControls } from "@/games/water-sort/ui/WaterSortPlay/WaterSortLabControls";

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
    onPourBottle?: (
      sourceBottleIndex: number,
      destinationBottleIndex: number,
      gesture?: WaterSortPourGesture,
    ) => void;
  };

export function WaterSortPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  state,
  moveCount,
  undoCount,
  canUndo,
  isDeadlocked,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  onPourBottle,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onClearAnimationComplete,
  onOpenGameHome,
  onBackToHome,
  onOpenDiagnostics,
}: WaterSortPlayProps) {
  const [hasActivePourAnimation, setHasActivePourAnimation] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const labEnabled = searchParams.get("waterSortLab") === "1";
  const appearanceParam = searchParams.get("waterSortAppearance");
  const appearance: WaterSortAppearance =
    labEnabled && appearanceParam === "glass" ? "glass" : "classic";
  function changeAppearance(next: WaterSortAppearance) {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set("waterSortAppearance", next);
        return params;
      },
      { replace: true },
    );
  }
  const showDeadlockNotice = isDeadlocked && !hasActivePourAnimation;
  useWaterSortSoundEffects(operation, progress);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={WATER_SORT_DISPLAY_NAME}
      background={
        <div
          className={`size-full ${
            appearance === "glass"
              ? "water-sort-scene-glass"
              : "bg-[#e5eef0] dark:bg-[#1c292d]"
          }`}
        />
      }
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
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <WaterSortHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <WaterSortResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordOutcomeNotice={recordOutcomeNotice}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-2 sm:px-6">
        {labEnabled && (
          <WaterSortLabControls
            appearance={appearance}
            onChange={changeAppearance}
          />
        )}
        <div className="min-h-0 w-full flex-1">
          <WaterSortBoard
            appearance={appearance}
            state={state}
            sourceBottleIndex={sourceBottleIndex}
            operation={operation}
            onSelectBottle={onSelectBottle}
            onPourBottle={appearance === "glass" ? onPourBottle : undefined}
            interactionDisabled={progress !== "playing"}
            onPourAnimationActivityChange={setHasActivePourAnimation}
            onClearAnimationComplete={onClearAnimationComplete}
          />
        </div>
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
