import { useMinesweeperPlay } from "@/games/minesweeper/play/use-minesweeper-play";
import { MinesweeperPlay } from "@/games/minesweeper/ui/MinesweeperPlay";
import { useNavigate } from "@/router";

export function MinesweeperPlayView() {
  const play = useMinesweeperPlay();
  const navigate = useNavigate();

  return (
    <MinesweeperPlay
      rows={play.rows}
      columns={play.columns}
      mineCount={play.mineCount}
      flagCount={play.flagCount}
      visibleCells={play.visibleCells}
      status={play.status}
      onRevealCell={play.revealCell}
      onToggleFlag={play.toggleFlag}
      onChordCell={play.chordCell}
      onReplay={play.replay}
      onBackToHome={() => navigate("/")}
    />
  );
}
