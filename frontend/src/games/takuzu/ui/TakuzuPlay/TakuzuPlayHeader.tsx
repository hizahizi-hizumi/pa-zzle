import { ArrowLeft, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getTakuzuDifficultyLabel,
  type TakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import { formatTakuzuElapsedTime } from "@/games/takuzu/ui/format-elapsed-time";

type TakuzuPlayHeaderProps = {
  difficulty: TakuzuDifficulty;
  elapsedMs: number;
  canRestart: boolean;
  onRestart: () => void;
  onBackToHome: () => void;
};

export function TakuzuPlayHeader({
  difficulty,
  elapsedMs,
  canRestart,
  onRestart,
  onBackToHome,
}: TakuzuPlayHeaderProps) {
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
        <h1 className="truncate text-play-context">バイナリパズル</h1>
        <p className="flex items-baseline gap-2 whitespace-nowrap text-play-meta text-muted-foreground">
          <span>{getTakuzuDifficultyLabel(difficulty)}</span>
          <span aria-hidden="true" className="text-border">
            ·
          </span>
          <span className="flex items-baseline gap-1">
            <span>経過時間</span>
            <span className="font-mono font-medium tabular-nums text-foreground/80">
              {formatTakuzuElapsedTime(elapsedMs)}
            </span>
          </span>
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="やり直す"
        disabled={!canRestart}
        onClick={onRestart}
      >
        <RotateCcw />
      </Button>
    </header>
  );
}
