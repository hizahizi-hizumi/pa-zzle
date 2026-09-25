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
      progress={play.progress}
      board={play.board}
      elapsedMs={play.elapsedMs}
      moveCount={play.moveCount}
      operation={play.operation}
      onSlideTile={play.slideTile}
      onSlideByKeyboard={play.slideByKeyboard}
      onRestart={play.restart}
      onReplay={play.replay}
      onStartNewProblem={play.startNewProblem}
      onClearingComplete={play.completeClearing}
      onBackToHome={() => navigate("/")}
    />
  );
}
