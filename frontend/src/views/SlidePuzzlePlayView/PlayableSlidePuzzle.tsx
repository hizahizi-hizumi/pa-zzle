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
