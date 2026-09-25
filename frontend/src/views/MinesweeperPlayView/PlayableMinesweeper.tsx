import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { useMinesweeperPlay } from "@/games/minesweeper/play/use-minesweeper-play";
import { MinesweeperPlay } from "@/games/minesweeper/ui/MinesweeperPlay";
import { useNavigate } from "@/router";

type PlayableMinesweeperProps = {
  difficulty: MinesweeperDifficulty;
};

export function PlayableMinesweeper({ difficulty }: PlayableMinesweeperProps) {
  const play = useMinesweeperPlay(difficulty);
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
      onChangeDifficulty={() => navigate("/puzzles/minesweeper")}
      onBackToHome={() => navigate("/")}
    />
  );
}
