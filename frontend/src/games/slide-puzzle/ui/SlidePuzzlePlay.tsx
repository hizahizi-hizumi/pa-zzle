import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { SlidePuzzleProgress } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type { SlidePuzzleBoard as SlidePuzzleBoardState } from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";
import { SlidePuzzleClearedPanel } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/SlidePuzzleClearedPanel";
import { SlidePuzzlePlayHeader } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/SlidePuzzlePlayHeader";

type SlidePuzzlePlayProps = {
  status: "playing" | "cleared";
  progress: SlidePuzzleProgress;
  board: SlidePuzzleBoardState;
  moveCount: number;
  onSlideTile: (tileIndex: number) => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onBackToHome: () => void;
};

export function SlidePuzzlePlay({
  status,
  progress,
  board,
  moveCount,
  onSlideTile,
  onReplay,
  onStartNewProblem,
  onBackToHome,
}: SlidePuzzlePlayProps) {
  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <SlidePuzzlePlayHeader
        moveCount={moveCount}
        onBackToHome={onBackToHome}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        <SlidePuzzleBoard
          board={board}
          interactionDisabled={progress !== "playing"}
          onSlideTile={onSlideTile}
        />
      </main>
      <footer className="grid h-28 shrink-0 items-center px-4 pb-2">
        {status === "cleared" && (
          <SlidePuzzleClearedPanel
            onReplay={onReplay}
            onStartNewProblem={onStartNewProblem}
          />
        )}
      </footer>
    </section>
  );
}
