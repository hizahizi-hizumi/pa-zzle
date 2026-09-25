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
      status={play.status}
      elapsedMs={play.elapsedMs}
      onCycleCell={play.cycleCell}
      onRestart={play.restart}
      onReplay={play.replay}
      onBackToHome={() => navigate("/")}
    />
  );
}
