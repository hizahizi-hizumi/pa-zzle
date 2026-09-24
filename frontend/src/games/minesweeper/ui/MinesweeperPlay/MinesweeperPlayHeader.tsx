import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlayHeaderSummary } from "./MinesweeperPlayHeader/PlayHeaderSummary";
import { PlayMenu } from "./MinesweeperPlayHeader/PlayMenu";

type MinesweeperPlayHeaderProps = {
  mineCount: number;
  flagCount: number;
  onReplay: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function MinesweeperPlayHeader({
  mineCount,
  flagCount,
  onReplay,
  onChangeDifficulty,
  onBackToHome,
}: MinesweeperPlayHeaderProps) {
  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start bg-background px-3 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="難易度選択へ戻る"
        onClick={onChangeDifficulty}
      >
        <ArrowLeft />
      </Button>
      <PlayHeaderSummary mineCount={mineCount} flagCount={flagCount} />
      <PlayMenu
        onReplay={onReplay}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />
    </header>
  );
}
