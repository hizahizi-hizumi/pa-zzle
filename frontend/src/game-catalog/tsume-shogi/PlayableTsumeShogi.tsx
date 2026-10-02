import { useMemo } from "react";

import { useGameNavigation } from "@/game-catalog/game-navigation";
import { useInternalDiagnosticsDialog } from "@/game-catalog/internal-diagnostics-dialog";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import type { ProblemId } from "@/games/problem-id";
import { createTsumeShogiDiagnosticSnapshot } from "@/games/tsume-shogi/diagnostics";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { useTsumeShogiPlay } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  createTsumeShogiPlayRecord,
  tsumeShogiPlayRecordDefinition,
} from "@/games/tsume-shogi/play-record";
import { selectTsumeShogiProblemById } from "@/games/tsume-shogi/problem-selection";
import { tsumeShogiPlayRecordDisplay } from "@/games/tsume-shogi/ui/play-record-display";
import { TsumeShogiDiagnostics } from "@/games/tsume-shogi/ui/TsumeShogiDiagnostics";
import { TsumeShogiPlay } from "@/games/tsume-shogi/ui/TsumeShogiPlay";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

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
  const { problemIdentity, poolReference, startedAt, completedAt, result } =
    play;
  const playRecord = useMemo(
    () =>
      result !== null && completedAt !== null
        ? createTsumeShogiPlayRecord({
            difficulty,
            problemIdentity,
            poolReference,
            workload: result.workload,
            startedAt,
            completedAt,
            result,
          })
        : null,
    [
      difficulty,
      problemIdentity,
      poolReference,
      startedAt,
      completedAt,
      result,
    ],
  );
  const recordOutcome = useSavePlayRecord(
    playRecord,
    tsumeShogiPlayRecordDefinition,
  );
  const diagnostics = useInternalDiagnosticsDialog((buildRevision) =>
    createTsumeShogiDiagnosticSnapshot({
      difficulty,
      problemIdentity,
      poolReference,
      problem: play.session.problem,
      buildRevision,
    }),
  );

  return (
    <>
      <TsumeShogiPlay
        difficulty={difficulty}
        progress={play.progress}
        elapsedMs={play.elapsedMs}
        result={result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={tsumeShogiPlayRecordDisplay}
          />
        }
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
        onOpenRecords={navigation.openRecords}
        onChangeDifficulty={navigation.changeDifficulty}
        onBackToHome={navigation.backToHome}
        onOpenDiagnostics={diagnostics.open}
      />
      {diagnostics.snapshot && (
        <TsumeShogiDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
