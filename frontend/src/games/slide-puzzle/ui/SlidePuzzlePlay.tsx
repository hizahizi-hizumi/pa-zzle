import { useEffect, useRef } from "react";
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
import type { SlidePuzzleExperience } from "@/games/slide-puzzle/ui/board/slide-puzzle-experience";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const isLab = searchParams.get("slideLab") === "1";
  const requestedExperience = searchParams.get("concept");
  const experience: SlidePuzzleExperience =
    isLab &&
    (requestedExperience === "kinetic" || requestedExperience === "pocket")
      ? requestedExperience
      : "classic";

  function changeExperience(value: SlidePuzzleExperience) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("slideLab", "1");
        next.set("concept", value);
        return next;
      },
      { replace: true },
    );
  }

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
      background={<div className="size-full bg-[#e8e2d8] dark:bg-[#2b2722]" />}
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
      <main className="relative flex min-h-0 flex-1 items-center justify-center px-3 pt-2 pb-6 [container-type:size] sm:px-6 sm:pb-8">
        {isLab && (
          <nav
            aria-label="体験の比較"
            className="absolute inset-x-2 top-2 z-10 flex justify-center gap-1 rounded-full p-1 text-[11px] sm:top-4 sm:text-xs"
          >
            {(
              [
                ["classic", "現行"],
                ["kinetic", "押し送る"],
                ["pocket", "空白を動かす"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-current={experience === value ? "true" : undefined}
                onClick={() => changeExperience(value)}
                className={`rounded-full px-3 py-1.5 transition-colors ${experience === value ? "bg-[#3b4449] text-white shadow-sm" : "bg-white/65 text-[#3b4449] hover:bg-white"}`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="relative aspect-square w-[min(100cqw,100cqh,40rem)]">
          <SlidePuzzleBoard
            board={board}
            experience={experience}
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
