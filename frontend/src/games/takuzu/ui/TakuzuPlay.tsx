import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { TakuzuProgress } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import { TakuzuClearedPanel } from "@/games/takuzu/ui/TakuzuPlay/TakuzuClearedPanel";
import { TakuzuPlayHeader } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader";
import { UndoButton } from "@/games/takuzu/ui/TakuzuPlay/UndoButton";

type TakuzuPlayProps = {
  size: number;
  cells: readonly TakuzuCellView[];
  lineViolations: readonly TakuzuLineViolationView[];
  progress: TakuzuProgress;
  correctionCount: number;
  undoCount: number;
  canUndo: boolean;
  elapsedMs: number;
  onCycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
  onPlaceCell: (cellIndex: number, cell: TakuzuCell) => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onClearAnimationComplete: () => void;
  onStartNewProblem?: () => void;
  onChangeDifficulty?: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function TakuzuPlay({
  size,
  cells,
  lineViolations,
  progress,
  correctionCount,
  undoCount,
  canUndo,
  elapsedMs,
  onCycleCell,
  onPlaceCell,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TakuzuPlayProps) {
  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <TakuzuPlayHeader
        correctionCount={correctionCount}
        elapsedMs={elapsedMs}
        undoCount={undoCount}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
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
              disabled={progress !== "playing"}
              onCycleCell={onCycleCell}
              onPlaceCell={onPlaceCell}
            />
          </TakuzuClearAnimation>
          {progress === "result" && (
            <TakuzuClearedPanel
              onReplay={onReplay}
              onStartNewProblem={onStartNewProblem}
            />
          )}
        </div>
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        <div className="flex h-14 items-center justify-center">
          <UndoButton
            disabled={progress !== "playing" || !canUndo}
            onUndo={onUndo}
          />
        </div>
      </footer>
    </section>
  );
}
