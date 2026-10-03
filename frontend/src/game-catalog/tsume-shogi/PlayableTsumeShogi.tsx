import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import type { ProblemId } from "@/games/problem-id";
import {
  getTsumeShogiDifficultyLabel,
  type TsumeShogiDifficulty,
} from "@/games/tsume-shogi/difficulty";
import { useTsumeShogiPlay } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { selectTsumeShogiProblemById } from "@/games/tsume-shogi/problem-selection";
import { TsumeShogiPlay } from "@/games/tsume-shogi/ui/TsumeShogiPlay";
import { useNavigate } from "@/router";

type PlayableTsumeShogiProps = {
  difficulty: TsumeShogiDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableTsumeShogi({
  difficulty,
  avoidedProblemId,
}: PlayableTsumeShogiProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectTsumeShogiProblemById(difficulty, problemId),
  );
  const play = useTsumeShogiPlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  useProblemIdQuerySync(play.problemIdentity);
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
