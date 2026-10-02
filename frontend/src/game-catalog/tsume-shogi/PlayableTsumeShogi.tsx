import { useGameNavigation } from "@/game-catalog/game-navigation";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import type { ProblemId } from "@/games/problem-id";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { useTsumeShogiPlay } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { selectTsumeShogiProblemById } from "@/games/tsume-shogi/problem-selection";
import { TsumeShogiPlay } from "@/games/tsume-shogi/ui/TsumeShogiPlay";

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
  const navigation = useGameNavigation({
    entryPath: "/puzzles/tsume-shogi",
    playPath: "/puzzles/tsume-shogi/play/:difficulty",
  });

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
      selection={play.selection}
      promotionChoice={play.promotionChoice}
      rejection={play.rejection}
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
      onOpenRecords={navigation.openRecords}
      onChangeDifficulty={navigation.changeDifficulty}
      onBackToHome={navigation.backToHome}
    />
  );
}
