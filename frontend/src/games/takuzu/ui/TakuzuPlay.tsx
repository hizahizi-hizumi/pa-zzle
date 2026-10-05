import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import type { TakuzuResult } from "@/games/takuzu/play/use-takuzu-play";
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

type TakuzuPlayProps = GamePlayScreenProps<TakuzuDifficulty, TakuzuResult> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    size: number;
    cells: readonly TakuzuCellView[];
    lineViolations: readonly TakuzuLineViolationView[];
    correctionCount: number;
    undoCount: number;
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
  canUndo,
  onCycleCell,
  onPlaceCell,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TakuzuPlayProps) {
  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={TAKUZU_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "置き直し", count: correctionCount },
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
        <TakuzuHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <TakuzuResultScreen
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
