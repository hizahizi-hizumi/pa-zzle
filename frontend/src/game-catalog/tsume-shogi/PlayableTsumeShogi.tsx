import {
  getTsumeShogiDifficultyLabel,
  type TsumeShogiDifficulty,
} from "@/games/tsume-shogi/difficulty";
import { useTsumeShogiPlay } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type { TsumeShogiIdentifiedProblem } from "@/games/tsume-shogi/problem/problem";
import { TsumeShogiPlay } from "@/games/tsume-shogi/ui/TsumeShogiPlay";
import { useNavigate } from "@/router";

/**
 * 最初に遊ぶ問題を指定する。
 * - `blind-comparison`: 人間の遊び比べ用に指定した問題。難易度を伏せる。
 */
type TsumeShogiInitialProblem = {
  problem: TsumeShogiIdentifiedProblem;
  purpose: "blind-comparison";
};

type PlayableTsumeShogiProps = {
  difficulty: TsumeShogiDifficulty;
  initialProblem?: TsumeShogiInitialProblem;
};

const BLIND_COMPARISON_DIFFICULTY_LABEL = "問題指定";

export function PlayableTsumeShogi({
  difficulty,
  initialProblem,
}: PlayableTsumeShogiProps) {
  const play = useTsumeShogiPlay(difficulty, initialProblem?.problem);
  const navigate = useNavigate();
  // 別の問題へ進むと指定した問題ではなくなるので、難易度を出す。
  const isBlindComparison =
    initialProblem?.purpose === "blind-comparison" &&
    play.problemSource === "given";

  return (
    <TsumeShogiPlay
      difficultyLabel={
        isBlindComparison
          ? BLIND_COMPARISON_DIFFICULTY_LABEL
          : getTsumeShogiDifficultyLabel(difficulty)
      }
      plies={play.plies}
      phase={play.phase}
      onWrongLine={play.onWrongLine}
      remainingPlies={play.remainingPlies}
      boardPieces={play.boardPieces}
      attackerHand={play.attackerHand}
      lastMove={play.lastMove}
      selection={play.selection}
      promotionChoice={play.promotionChoice}
      rejection={play.rejection}
      elapsedMs={play.elapsedMs}
      canUndo={play.canUndo}
      canRestart={play.canRestart}
      onTapSquare={play.tapSquare}
      onTapHand={play.tapHand}
      onChoosePromotion={play.choosePromotion}
      onCancelPromotion={play.cancelPromotion}
      onReturnToDecision={play.returnToDecision}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onStartNewProblem={play.startNewProblem}
      // 難易度選択はまだ無いので、ホームへ戻す。
      onChangeDifficulty={() => navigate("/")}
      onBackToHome={() => navigate("/")}
    />
  );
}
