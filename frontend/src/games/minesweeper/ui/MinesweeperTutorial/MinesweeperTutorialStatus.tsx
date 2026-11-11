import { StatusMetric } from "@/games/minesweeper/ui/MinesweeperTutorial/MinesweeperTutorialStatus/StatusMetric";

type MinesweeperTutorialStatusProps = {
  mineCount: number;
  flagCount: number;
  /** 手を引いている間、地雷の総数を次の操作を決める手がかりとして覆いから抜く。 */
  mineCountSpotlit: boolean;
};

/**
 * 盤面の上に、本番の見出しと同じ書式で地雷と旗の数を並べる。
 * 地雷の総数は解く手がかりなので、盤面と一緒に見える位置に置く。旗の切り替えは本番と同じく盤面の下に置く。
 */
export function MinesweeperTutorialStatus({
  mineCount,
  flagCount,
  mineCountSpotlit,
}: MinesweeperTutorialStatusProps) {
  return (
    <div className="flex h-5 items-center gap-2 text-muted-foreground text-play-meta">
      <StatusMetric label="地雷" value={mineCount} spotlit={mineCountSpotlit} />
      <span aria-hidden="true" className="text-border">
        ·
      </span>
      <StatusMetric label="旗" value={flagCount} spotlit={false} />
    </div>
  );
}
