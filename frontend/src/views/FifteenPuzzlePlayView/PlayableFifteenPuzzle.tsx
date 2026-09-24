import type { FifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/difficulty";
import { useFifteenPuzzlePlay } from "@/games/fifteen-puzzle/play/use-fifteen-puzzle-play";
import { FifteenPuzzlePlay } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay";
import { useNavigate } from "@/router";

type PlayableFifteenPuzzleProps = {
  difficulty: FifteenPuzzleDifficulty;
};

export function PlayableFifteenPuzzle({
  difficulty,
}: PlayableFifteenPuzzleProps) {
  const play = useFifteenPuzzlePlay(difficulty);
  const navigate = useNavigate();

  return (
    <FifteenPuzzlePlay
      status={play.status}
      progress={play.progress}
      board={play.board}
      moveCount={play.moveCount}
      onSlideTile={play.slideTile}
      onReplay={play.replay}
      onStartNewProblem={play.startNewProblem}
      onBackToHome={() => navigate("/")}
    />
  );
}
