import { useMinesweeperProblemPlay } from "@/games/minesweeper/play/use-minesweeper-problem-play";
import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";
import { MinesweeperPlay } from "@/games/minesweeper/ui/MinesweeperPlay";
import { useNavigate } from "@/router";

type ReviewProblemPlayProps = {
  problem: MinesweeperProblem;
};

export function ReviewProblemPlay({ problem }: ReviewProblemPlayProps) {
  const play = useMinesweeperProblemPlay(problem);
  const navigate = useNavigate();

  function backToReview(): void {
    navigate("/puzzles/minesweeper/difficulty-review");
  }

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
      onChangeDifficulty={backToReview}
      onBackToHome={() => navigate("/")}
    />
  );
}
