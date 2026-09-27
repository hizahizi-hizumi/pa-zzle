import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlayHeaderSummary } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/SlidePuzzlePlayHeader/PlayHeaderSummary";
import { PlayMenu } from "@/games/slide-puzzle/ui/SlidePuzzlePlay/SlidePuzzlePlayHeader/PlayMenu";

type SlidePuzzlePlayHeaderProps = {
  elapsedMs: number;
  moveCount: number;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onBackToHome: () => void;
};

export function SlidePuzzlePlayHeader({
  elapsedMs,
  moveCount,
  onRestart,
  onReplay,
  onStartNewProblem,
  onBackToHome,
}: SlidePuzzlePlayHeaderProps) {
  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start bg-background px-3 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="ホームへ戻る"
        onClick={onBackToHome}
      >
        <ArrowLeft />
      </Button>
      <PlayHeaderSummary elapsedMs={elapsedMs} moveCount={moveCount} />
      <PlayMenu
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onBackToHome={onBackToHome}
      />
    </header>
  );
}
