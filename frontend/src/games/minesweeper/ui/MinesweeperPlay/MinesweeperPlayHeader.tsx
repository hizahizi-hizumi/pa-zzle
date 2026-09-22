import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

type MinesweeperPlayHeaderProps = {
  mineCount: number;
  flagCount: number;
  onBackToHome: () => void;
};

export function MinesweeperPlayHeader({
  mineCount,
  flagCount,
  onBackToHome,
}: MinesweeperPlayHeaderProps) {
  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start bg-background px-3 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="ホームへ戻る"
        onClick={onBackToHome}
      >
        <ArrowLeft aria-hidden />
      </Button>
      <div className="flex h-10 items-center justify-center gap-4 text-play-meta text-muted-foreground tabular-nums">
        <span>地雷 {mineCount}</span>
        <span>旗 {flagCount}</span>
      </div>
      <span aria-hidden />
    </header>
  );
}
