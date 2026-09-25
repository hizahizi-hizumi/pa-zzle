import { useEffect, useRef } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type {
  SlidePuzzleOperation,
  SlidePuzzleProgress,
} from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type { SlidePuzzleDirection } from "@/games/slide-puzzle/puzzle/rules";
import type { SlidePuzzleBoard as SlidePuzzleBoardState } from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";
import { SlidePuzzleClearedPanel } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/SlidePuzzleClearedPanel";
import { SlidePuzzlePlayHeader } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/SlidePuzzlePlayHeader";

type SlidePuzzlePlayProps = {
  progress: SlidePuzzleProgress;
  board: SlidePuzzleBoardState;
  elapsedMs: number;
  moveCount: number;
  operation: SlidePuzzleOperation | null;
  onSlideTile: (tileIndex: number) => void;
  onSlideByKeyboard: (direction: SlidePuzzleDirection) => void;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onClearingComplete: () => void;
  onBackToHome: () => void;
};

const directionByArrowKey: Readonly<Record<string, SlidePuzzleDirection>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function SlidePuzzlePlay({
  progress,
  board,
  elapsedMs,
  moveCount,
  operation,
  onSlideTile,
  onSlideByKeyboard,
  onRestart,
  onReplay,
  onStartNewProblem,
  onClearingComplete,
  onBackToHome,
}: SlidePuzzlePlayProps) {
  const playAreaRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (progress !== "playing") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const direction = directionByArrowKey[event.key];
      // メニューはプレイ画面の外へ描画される。そこでの操作や、矢印キーを自分で扱う部品の操作は盤面へ流さない。
      const { target } = event;
      const targetsPlayArea =
        target === document.body ||
        (target instanceof Node && playAreaRef.current?.contains(target));
      if (
        !direction ||
        !targetsPlayArea ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      onSlideByKeyboard(direction);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSlideByKeyboard, progress]);

  return (
    <section
      ref={playAreaRef}
      className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <BrandIdentityHeader />
      <SlidePuzzlePlayHeader
        elapsedMs={elapsedMs}
        moveCount={moveCount}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onBackToHome={onBackToHome}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 pt-2 pb-6 [container-type:size] sm:px-6 sm:pb-8">
        <div className="relative aspect-square w-[min(100cqw,100cqh,40rem)]">
          <SlidePuzzleBoard
            board={board}
            operation={operation}
            interactionDisabled={progress !== "playing"}
            clearing={progress === "clearing"}
            onSlideTile={onSlideTile}
            onClearingComplete={onClearingComplete}
          />
          {progress === "result" && (
            <SlidePuzzleClearedPanel
              onReplay={onReplay}
              onStartNewProblem={onStartNewProblem}
            />
          )}
        </div>
      </main>
    </section>
  );
}
