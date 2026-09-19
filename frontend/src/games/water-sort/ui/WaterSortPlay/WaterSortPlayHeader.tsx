import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlayHeaderSummary } from "@/games/water-sort/ui/WaterSortPlay/WaterSortPlayHeader/PlayHeaderSummary";
import { PlayMenu } from "@/games/water-sort/ui/WaterSortPlay/WaterSortPlayHeader/PlayMenu";

type WaterSortPlayHeaderProps = {
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  onRestart: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function WaterSortPlayHeader({
  elapsedMs,
  moveCount,
  undoCount,
  onRestart,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: WaterSortPlayHeaderProps) {
  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start bg-background px-3 pt-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="難易度選択へ戻る"
        onClick={onChangeDifficulty}
      >
        <ArrowLeft />
      </Button>
      <PlayHeaderSummary
        elapsedMs={elapsedMs}
        moveCount={moveCount}
        undoCount={undoCount}
      />
      <PlayMenu
        onRestart={onRestart}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
    </header>
  );
}
