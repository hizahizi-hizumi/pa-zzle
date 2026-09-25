import { useEffect, useRef } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type {
  FifteenPuzzleOperation,
  FifteenPuzzleProgress,
} from "@/games/fifteen-puzzle/play/use-fifteen-puzzle-play";
import type { FifteenPuzzleDirection } from "@/games/fifteen-puzzle/puzzle/rules";
import type { FifteenPuzzleBoard as FifteenPuzzleBoardState } from "@/games/fifteen-puzzle/puzzle/state";
import { FifteenPuzzleBoard } from "@/games/fifteen-puzzle/ui/board/FifteenPuzzleBoard";
import { FifteenPuzzleClearedPanel } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzleClearedPanel";
import { FifteenPuzzlePlayHeader } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay/FifteenPuzzlePlayHeader";

type FifteenPuzzlePlayProps = {
  progress: FifteenPuzzleProgress;
  board: FifteenPuzzleBoardState;
  elapsedMs: number;
  moveCount: number;
  operation: FifteenPuzzleOperation | null;
  onSlideTile: (tileIndex: number) => void;
  onSlideByKeyboard: (direction: FifteenPuzzleDirection) => void;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onClearingComplete: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

const directionByArrowKey: Readonly<Record<string, FifteenPuzzleDirection>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function FifteenPuzzlePlay({
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
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: FifteenPuzzlePlayProps) {
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
      <FifteenPuzzlePlayHeader
        elapsedMs={elapsedMs}
        moveCount={moveCount}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 pt-2 pb-6 [container-type:size] sm:px-6 sm:pb-8">
        <div className="relative aspect-square w-[min(100cqw,100cqh,40rem)]">
          <FifteenPuzzleBoard
            board={board}
            operation={operation}
            interactionDisabled={progress !== "playing"}
            clearing={progress === "clearing"}
            onSlideTile={onSlideTile}
            onClearingComplete={onClearingComplete}
          />
          {progress === "result" && (
            <FifteenPuzzleClearedPanel
              onReplay={onReplay}
              onStartNewProblem={onStartNewProblem}
            />
          )}
        </div>
      </main>
    </section>
  );
}
