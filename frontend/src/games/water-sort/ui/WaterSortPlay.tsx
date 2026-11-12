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
  WaterSortResult,
} from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";
import { WaterSortResultScreen } from "@/games/water-sort/ui/result/WaterSortResultScreen";
import { useWaterSortSoundEffects } from "@/games/water-sort/ui/use-water-sort-sound-effects";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { DeadlockNotice } from "@/games/water-sort/ui/WaterSortPlay/DeadlockNotice";
import { WaterSortExperimentBoard } from "@/games/water-sort/ui/WaterSortPlay/WaterSortExperimentBoard";
import { WaterSortLabControls } from "@/games/water-sort/ui/WaterSortPlay/WaterSortLabControls";
import type { WaterSortExperience } from "@/games/water-sort/ui/WaterSortPlay/water-sort-experience";
import { WATER_SORT_EXPERIENCES } from "@/games/water-sort/ui/WaterSortPlay/water-sort-experience";
import { WaterSortTutorial } from "@/games/water-sort/ui/WaterSortTutorial";

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
    ) => void;
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
  const requestedExperience = searchParams.get("waterSortExperience");
  const experience: WaterSortExperience =
    labEnabled &&
    WATER_SORT_EXPERIENCES.some((value) => value === requestedExperience)
      ? (requestedExperience as WaterSortExperience)
      : "classic";
  function changeExperience(next: WaterSortExperience) {
    setSearchParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        updated.set("waterSortExperience", next);
        return updated;
      },
      { replace: true },
    );
  }
  const showDeadlockNotice = isDeadlocked && !hasActivePourAnimation;
  useWaterSortSoundEffects(operation, progress, experience);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={WATER_SORT_DISPLAY_NAME}
      background={<div className="size-full bg-[#e5eef0] dark:bg-[#1c292d]" />}
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
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-2 sm:px-6">
        {labEnabled && (
          <WaterSortLabControls
            experience={experience}
            onChange={changeExperience}
            disabled={progress !== "playing"}
          />
        )}
        <div className="min-h-0 w-full flex-1">
          {experience === "classic" ? (
            <WaterSortBoard
              state={state}
              sourceBottleIndex={sourceBottleIndex}
              operation={operation}
              onSelectBottle={onSelectBottle}
              interactionDisabled={progress !== "playing"}
              onPourAnimationActivityChange={setHasActivePourAnimation}
              onClearAnimationComplete={onClearAnimationComplete}
            />
          ) : (
            <WaterSortExperimentBoard
              experience={experience}
              state={state}
              sourceBottleIndex={sourceBottleIndex}
              operation={operation}
              onSelectBottle={onSelectBottle}
              onPourBottle={onPourBottle}
              interactionDisabled={progress !== "playing"}
              onPourAnimationActivityChange={setHasActivePourAnimation}
              onClearAnimationComplete={onClearAnimationComplete}
            />
          )}
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
