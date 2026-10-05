import { useEffect, useRef } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
} from "@/games/play";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import type {
  SlidePuzzleOperation,
  SlidePuzzleResult,
} from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type { SlidePuzzleDirection } from "@/games/slide-puzzle/puzzle/rules";
import type { SlidePuzzleBoard as SlidePuzzleBoardState } from "@/games/slide-puzzle/puzzle/state";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";
import { SlidePuzzleResultScreen } from "@/games/slide-puzzle/ui/result/SlidePuzzleResultScreen";
import { SlidePuzzleHowToPlayDialog } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog";

type SlidePuzzlePlayProps = GamePlayScreenProps<
  SlidePuzzleDifficulty,
  SlidePuzzleResult
> &
  RestartableGamePlayScreenProps & {
    board: SlidePuzzleBoardState;
    moveCount: number;
    operation: SlidePuzzleOperation | null;
    onSlideTile: (tileIndex: number) => void;
    onSlideInDirection: (direction: SlidePuzzleDirection) => void;
    onClearAnimationComplete: () => void;
  };

const directionByArrowKey: Readonly<Record<string, SlidePuzzleDirection>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function SlidePuzzlePlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  board,
  moveCount,
  operation,
  onSlideTile,
  onSlideInDirection,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onClearAnimationComplete,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: SlidePuzzlePlayProps) {
  const playAreaRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (progress !== "playing") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const direction = directionByArrowKey[event.key];
      // メニューやダイアログはプレイ画面の外へ描画される。そこでの操作や、矢印キーを自分で扱う部品の操作は盤面へ流さない。
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
      onSlideInDirection(direction);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSlideInDirection, progress]);

  return (
    <GamePlayFrame
      ref={playAreaRef}
      progress={progress}
      result={result}
      title={SLIDE_PUZZLE_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "手数", count: moveCount },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <SlidePuzzleHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <SlidePuzzleResultScreen
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
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 pt-2 pb-6 [container-type:size] sm:px-6 sm:pb-8">
        <div className="relative aspect-square w-[min(100cqw,100cqh,40rem)]">
          <SlidePuzzleBoard
            board={board}
            operation={operation}
            interactionDisabled={progress !== "playing"}
            clearing={progress === "clearing"}
            onSlideTile={onSlideTile}
            onClearAnimationComplete={onClearAnimationComplete}
          />
        </div>
      </main>
    </GamePlayFrame>
  );
}
