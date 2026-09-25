import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type { TakuzuProgress } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import { TakuzuClearedPanel } from "@/games/takuzu/ui/TakuzuPlay/TakuzuClearedPanel";
import { TakuzuPlayHeader } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader";

type TakuzuPlayProps = {
  difficulty: TakuzuDifficulty;
  size: number;
  cells: readonly TakuzuCellView[];
  progress: TakuzuProgress;
  elapsedMs: number;
  onCycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
  onPlaceCell: (cellIndex: number, cell: TakuzuCell) => void;
  onRestart: () => void;
  onReplay: () => void;
  onClearingComplete: () => void;
  onStartNewProblem?: () => void;
  onChangeDifficulty?: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function TakuzuPlay({
  difficulty,
  size,
  cells,
  progress,
  elapsedMs,
  onCycleCell,
  onPlaceCell,
  onRestart,
  onReplay,
  onClearingComplete,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TakuzuPlayProps) {
  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <TakuzuPlayHeader
        difficulty={difficulty}
        elapsedMs={elapsedMs}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-2 pt-1 pb-6 [container-type:size] sm:px-6 sm:pb-8">
        <div className="relative aspect-square w-[min(100cqw,100cqh,40rem)]">
          <TakuzuBoard
            size={size}
            cells={cells}
            disabled={progress !== "playing"}
            clearing={progress === "clearing"}
            onCycleCell={onCycleCell}
            onPlaceCell={onPlaceCell}
            onClearingComplete={onClearingComplete}
          />
          {progress === "result" && (
            <TakuzuClearedPanel
              onReplay={onReplay}
              onStartNewProblem={onStartNewProblem}
            />
          )}
        </div>
      </main>
    </section>
  );
}
