import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { useSlidePuzzlePlay } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { SlidePuzzlePlay } from "@/games/slide-puzzle/ui/SlidePuzzlePlay";
import { useNavigate } from "@/router";

type PlayableSlidePuzzleProps = {
  difficulty: SlidePuzzleDifficulty;
};

export function PlayableSlidePuzzle({ difficulty }: PlayableSlidePuzzleProps) {
  const play = useSlidePuzzlePlay(difficulty);
  const navigate = useNavigate();

  return (
    <SlidePuzzlePlay
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
