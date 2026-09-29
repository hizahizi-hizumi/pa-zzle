import {
  getReflectionDifficultyLabel,
  type ReflectionDifficulty,
} from "@/games/reflection/difficulty";
import { useReflectionPlay } from "@/games/reflection/play/use-reflection-play";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { ReflectionPlay } from "@/games/reflection/ui/ReflectionPlay";
import { useNavigate } from "@/router";

/**
 * 最初に遊ぶ問題を identity で指定する。
 * - `blind-comparison`: 人間の遊び比べ用に指定した問題。難易度を伏せる。
 */
type ReflectionInitialProblem = {
  identity: ReflectionProblemIdentity;
  purpose: "blind-comparison";
};

type PlayableReflectionProps = {
  difficulty: ReflectionDifficulty;
  initialProblem?: ReflectionInitialProblem;
};

const BLIND_COMPARISON_DIFFICULTY_LABEL = "問題指定";

export function PlayableReflection({
  difficulty,
  initialProblem,
}: PlayableReflectionProps) {
  const play = useReflectionPlay(difficulty, initialProblem?.identity);
  const navigate = useNavigate();
  const isBlindComparison =
    initialProblem?.purpose === "blind-comparison" &&
    play.problemSource === "given";

  return (
    <ReflectionPlay
      difficultyLabel={
        isBlindComparison
          ? BLIND_COMPARISON_DIFFICULTY_LABEL
          : getReflectionDifficultyLabel(difficulty)
      }
      status={play.status}
      board={play.board}
      clues={play.clues}
      inventory={play.inventory}
      stock={play.stock}
      selection={play.selection}
      elapsedMs={play.elapsedMs}
      canUndo={play.canUndo}
      canRestart={play.canRestart}
      onTapCell={play.tapCell}
      onTapStock={play.tapStock}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onStartNewProblem={play.startNewProblem}
      onBackToHome={() => navigate("/")}
    />
  );
}
