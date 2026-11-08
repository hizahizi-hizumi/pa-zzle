import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

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
import {
  type SlidePuzzleSurface,
  slidePuzzleSurfaces,
} from "@/games/slide-puzzle/ui/board/slide-puzzle-surface";
import { SlidePuzzleResultScreen } from "@/games/slide-puzzle/ui/result/SlidePuzzleResultScreen";
import { SlidePuzzleHowToPlayDialog } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog";
import { useSlidePuzzleSoundEffects } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/use-slide-puzzle-sound-effects";

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
  onClearAnimationComplete,
  onOpenGameHome,
  onBackToHome,
  onOpenDiagnostics,
}: SlidePuzzlePlayProps) {
  const playAreaRef = useRef<HTMLElement>(null);
  const [searchParams] = useSearchParams();
  const compareSurfaces = searchParams.get("slideDesign") === "compare";
  const [surface, setSurface] = useState<SlidePuzzleSurface>("original");
  useSlidePuzzleSoundEffects(operation, progress, board.length - 1);

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
      background={
        <div
          className={`size-full transition-colors duration-(--duration-normal) motion-reduce:transition-none ${
            compareSurfaces && surface === "crafted"
              ? "bg-[#ede2d4] dark:bg-[#302820]"
              : compareSurfaces && surface === "precision"
                ? "bg-[#e3eaf0] dark:bg-[#202d38]"
                : compareSurfaces && surface === "playful"
                  ? "bg-[#f5eee0] dark:bg-[#322d32]"
                  : "bg-[#e8e2d8] dark:bg-[#2b2722]"
          }`}
        />
      }
      metrics={[
        { type: "count", label: "手数", count: moveCount },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
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
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 pt-2 pb-6 [container-type:size] sm:px-6 sm:pb-8">
        <div
          className={`relative aspect-square ${
            compareSurfaces
              ? "w-[min(100cqw,100cqh,40rem)] sm:w-[min(100cqw,calc(100cqh-10rem),40rem)] xl:w-[min(100cqw,100cqh,40rem)]"
              : "w-[min(100cqw,100cqh,40rem)]"
          }`}
        >
          {compareSurfaces && (
            <div
              role="group"
              aria-label="盤面デザイン比較"
              className="absolute bottom-[calc(100%+12px)] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-foreground/10 bg-background/90 p-1 shadow-sm backdrop-blur-sm xl:top-1/2 xl:right-[calc(100%+16px)] xl:bottom-auto xl:left-auto xl:-translate-y-1/2 xl:translate-x-0 xl:flex-col xl:items-stretch xl:rounded-2xl"
            >
              {slidePuzzleSurfaces.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={surface === option.id}
                  onClick={() => setSurface(option.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    surface === option.id
                      ? "bg-foreground text-background"
                      : "text-foreground/75 hover:bg-foreground/10"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <SlidePuzzleBoard
            board={board}
            surface={surface}
            gestureEnabled={compareSurfaces}
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
