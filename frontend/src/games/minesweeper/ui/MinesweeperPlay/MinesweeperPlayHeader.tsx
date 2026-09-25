import { ChevronLeft } from "lucide-react";

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
    <header className="flex h-12 shrink-0 items-center justify-between px-3 sm:px-6">
      <Button variant="ghost" size="sm" onClick={onBackToHome}>
        <ChevronLeft aria-hidden />
        戻る
      </Button>
      <div className="flex items-center gap-4 text-play-meta text-muted-foreground tabular-nums">
        <span>地雷 {mineCount}</span>
        <span>旗 {flagCount}</span>
      </div>
    </header>
  );
}
