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
      size={play.size}
      cells={play.cells}
      lineViolations={play.lineViolations}
      progress={play.progress}
      correctionCount={play.correctionCount}
      undoCount={play.undoCount}
      canUndo={play.canUndo}
      elapsedMs={play.elapsedMs}
      onCycleCell={play.cycleCell}
      onPlaceCell={play.placeCell}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onStartNewProblem={play.startNewProblem}
      onClearAnimationComplete={play.completeClearAnimation}
      onChangeDifficulty={() => navigate("/puzzles/takuzu")}
      onBackToHome={() => navigate("/")}
    />
  );
}
