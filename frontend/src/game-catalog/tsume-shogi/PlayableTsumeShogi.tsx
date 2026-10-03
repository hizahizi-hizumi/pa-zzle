import {
  getTsumeShogiDifficultyLabel,
  type TsumeShogiDifficulty,
} from "@/games/tsume-shogi/difficulty";
import { useTsumeShogiPlay } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { TsumeShogiPlay } from "@/games/tsume-shogi/ui/TsumeShogiPlay";
import { useNavigate } from "@/router";

type PlayableTsumeShogiProps = {
  difficulty: TsumeShogiDifficulty;
};

export function PlayableTsumeShogi({ difficulty }: PlayableTsumeShogiProps) {
  const play = useTsumeShogiPlay(difficulty);
  const navigate = useNavigate();

  return (
    <TsumeShogiPlay
      difficultyLabel={getTsumeShogiDifficultyLabel(difficulty)}
      plies={play.plies}
      progress={play.progress}
      phase={play.phase}
      boardPieces={play.boardPieces}
      attackerHand={play.attackerHand}
      shownMoves={play.shownMoves}
      shownMovesRestored={play.shownMovesRestored}
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
      onClearSelection={play.clearSelection}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onClearAnimationComplete={play.completeClearAnimation}
      onStartNewProblem={play.startNewProblem}
      // 難易度選択はまだ無いので、ホームへ戻す。
      onChangeDifficulty={() => navigate("/")}
      onBackToHome={() => navigate("/")}
    />
  );
}
