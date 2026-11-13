import { StatusMetric } from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialStatus/StatusMetric";

type MinesweeperTutorialStatusProps = {
  mineCount: number;
  flagCount: number;
  mineCountSpotlit: boolean;
};

/** 地雷の総数は解く手がかりなので、盤面と一緒に見える位置に置く。 */
export function MinesweeperTutorialStatus({
  mineCount,
  flagCount,
  mineCountSpotlit,
}: MinesweeperTutorialStatusProps) {
  return (
    <div className="flex h-11 items-center">
      <div className="flex items-center gap-2 text-muted-foreground text-play-meta">
        <StatusMetric
          label="地雷"
          value={mineCount}
          spotlit={mineCountSpotlit}
        />
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <StatusMetric label="旗" value={flagCount} spotlit={false} />
      </div>
    </div>
  );
}
