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
      boardPieces={play.boardPieces}
      attackerHand={play.attackerHand}
      shownMoves={play.shownMoves}
      shownMovesRestored={play.shownMovesRestored}
      precedingMoveTo={play.precedingMoveTo}
      boardPieceIds={play.boardPieceIds}
      selection={play.selection}
      promotionChoice={play.promotionChoice}
      rejection={play.rejection}
      operation={play.operation}
      canUndo={play.canUndo}
      canRestart={play.canRestart}
      onSelectSquare={play.selectSquare}
      onSelectHandPiece={play.selectHandPiece}
      onChoosePromotion={play.choosePromotion}
      onCancelPromotion={play.cancelPromotion}
      onClearSelection={play.clearSelection}
      onUndo={play.undo}
      onRestart={play.restart}
      onReplay={play.replay}
      onClearAnimationComplete={play.completeClearAnimation}
      onStartNewProblem={play.startNewProblem}
      onOpenRecords={() => navigate("/records")}
      // 難易度選択はまだ無いので、ホームへ戻す。
      onChangeDifficulty={() => navigate("/")}
      onBackToHome={() => navigate("/")}
    />
  );
}
