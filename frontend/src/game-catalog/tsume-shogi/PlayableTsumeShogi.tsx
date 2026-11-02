import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
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
      difficulty={difficulty}
      progress={play.progress}
      elapsedMs={play.elapsedMs}
      result={play.result}
      recordOutcomeNotice={null}
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
      canUndo={play.canUndo}
      canRestart={play.canRestart}
      onTapSquare={play.tapSquare}
      onTapHand={play.tapHand}
      onChoosePromotion={play.choosePromotion}
      onCancelPromotion={play.cancelPromotion}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onClearAnimationComplete={play.completeClearAnimation}
      onStartNewProblem={play.startNewProblem}
      // 難易度選択はまだ無いので、ホームへ戻す。
      onOpenRecords={() => navigate("/records")}
      onChangeDifficulty={() => navigate("/")}
      onBackToHome={() => navigate("/")}
    />
  );
}
