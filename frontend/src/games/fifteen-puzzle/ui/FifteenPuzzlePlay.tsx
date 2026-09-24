import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { FifteenPuzzleProgress } from "@/games/fifteen-puzzle/play/use-fifteen-puzzle-play";
import type { FifteenPuzzleBoard as FifteenPuzzleBoardState } from "@/games/fifteen-puzzle/puzzle/state";
import { FifteenPuzzleBoard } from "@/games/fifteen-puzzle/ui/board/FifteenPuzzleBoard";
import { FifteenPuzzleClearedPanel } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzleClearedPanel";
import { FifteenPuzzlePlayHeader } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzlePlayHeader";

type FifteenPuzzlePlayProps = {
  status: "playing" | "cleared";
  progress: FifteenPuzzleProgress;
  board: FifteenPuzzleBoardState;
  moveCount: number;
  onSlideTile: (tileIndex: number) => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onBackToHome: () => void;
};

export function FifteenPuzzlePlay({
  status,
  progress,
  board,
  moveCount,
  onSlideTile,
  onReplay,
  onStartNewProblem,
  onBackToHome,
}: FifteenPuzzlePlayProps) {
  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <FifteenPuzzlePlayHeader
        moveCount={moveCount}
        onBackToHome={onBackToHome}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        <FifteenPuzzleBoard
          board={board}
          interactionDisabled={progress !== "playing"}
          onSlideTile={onSlideTile}
        />
      </main>
      <footer className="grid h-28 shrink-0 items-center px-4 pb-2">
        {status === "cleared" && (
          <FifteenPuzzleClearedPanel
            onReplay={onReplay}
            onStartNewProblem={onStartNewProblem}
          />
        )}
      </footer>
    </section>
  );
}
