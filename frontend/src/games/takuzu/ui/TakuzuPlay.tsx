import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import type {
  TakuzuOperation,
  TakuzuResult,
} from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import { TakuzuResultScreen } from "@/games/takuzu/ui/result/TakuzuResultScreen";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { useTakuzuSoundEffects } from "@/games/takuzu/ui/TakuzuPlay/use-takuzu-sound-effects";

type TakuzuPlayProps = GamePlayScreenProps<TakuzuDifficulty, TakuzuResult> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    size: number;
    cells: readonly TakuzuCellView[];
    lineViolations: readonly TakuzuLineViolationView[];
    correctionCount: number;
    undoCount: number;
    operation: TakuzuOperation | null;
    onCycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
    onPlaceCell: (cellIndex: number, cell: TakuzuCell) => void;
  };

export function TakuzuPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  size,
  cells,
  lineViolations,
  correctionCount,
  undoCount,
  operation,
  canUndo,
  onCycleCell,
  onPlaceCell,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenGameHome,
  onBackToHome,
  onOpenDiagnostics,
}: TakuzuPlayProps) {
  useTakuzuSoundEffects(operation, progress);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={TAKUZU_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "置き直し", count: correctionCount },
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
        <TakuzuHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <TakuzuResultScreen
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
      <main className="flex min-h-0 flex-1 items-center justify-center py-2 [container-type:size] sm:px-3">
        <div className="relative aspect-square w-[min(100cqw,100cqh,42rem)]">
          <TakuzuClearAnimation
            active={progress === "clearing"}
            onComplete={onClearAnimationComplete}
          >
            <TakuzuBoard
              size={size}
              cells={cells}
              lineViolations={lineViolations}
              operation={operation}
              interactionDisabled={progress !== "playing"}
              onCycleCell={onCycleCell}
              onPlaceCell={onPlaceCell}
            />
          </TakuzuClearAnimation>
        </div>
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        <div className="flex h-14 items-center justify-center">
          <UndoButton disabled={!canUndo} onUndo={onUndo} />
        </div>
      </footer>
    </GamePlayFrame>
  );
}
