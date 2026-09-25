import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

type SlidePuzzlePlayHeaderProps = {
  moveCount: number;
  onBackToHome: () => void;
};

export function SlidePuzzlePlayHeader({
  moveCount,
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
      <div className="flex min-w-0 flex-col items-center gap-0.5 pt-1 text-center">
        <h1 className="truncate text-play-context">スライドパズル</h1>
        <p className="flex items-baseline gap-1 whitespace-nowrap text-play-meta text-muted-foreground">
          <span>手数</span>
          <span className="font-mono font-medium tabular-nums text-foreground/80">
            {moveCount}
          </span>
        </p>
      </div>
    </header>
  );
}
