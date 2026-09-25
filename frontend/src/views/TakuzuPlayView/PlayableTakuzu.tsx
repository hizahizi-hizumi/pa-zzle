import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { useTakuzuPlay } from "@/games/takuzu/play/use-takuzu-play";
import { TakuzuPlay } from "@/games/takuzu/ui/TakuzuPlay";
import { useNavigate } from "@/router";

type PlayableTakuzuProps = {
  difficulty: TakuzuDifficulty;
};

export function PlayableTakuzu({ difficulty }: PlayableTakuzuProps) {
  const play = useTakuzuPlay(difficulty);
  const navigate = useNavigate();

  return (
    <TakuzuPlay
      difficulty={play.difficulty}
      size={play.size}
      cells={play.cells}
      progress={play.progress}
      elapsedMs={play.elapsedMs}
      onCycleCell={play.cycleCell}
      onPlaceCell={play.placeCell}
      onRestart={play.restart}
      onReplay={play.replay}
      onClearingComplete={play.completeClearing}
      onBackToHome={() => navigate("/")}
    />
  );
}
