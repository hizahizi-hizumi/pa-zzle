import { useCallback } from "react";

import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/app/game-integration/playable-game";
import { tsumeShogiCatalogEntry } from "@/app/game-integration/tsume-shogi/tsume-shogi-catalog-entry";
import type { ProblemId } from "@/games/problem-id";
import { createTsumeShogiDiagnosticSnapshot } from "@/games/tsume-shogi/diagnostics";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import {
  type TsumeShogiResult,
  useTsumeShogiPlay,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { createTsumeShogiPlayAttemptProgress } from "@/games/tsume-shogi/play-attempt";
import {
  createTsumeShogiPlayRecord,
  tsumeShogiPlayRecordDefinition,
} from "@/games/tsume-shogi/play-record";
import type { TsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import { selectTsumeShogiProblemById } from "@/games/tsume-shogi/problem-selection";
import { TsumeShogiDiagnostics } from "@/games/tsume-shogi/ui/TsumeShogiDiagnostics";
import { TsumeShogiPlay } from "@/games/tsume-shogi/ui/TsumeShogiPlay";

type PlayableTsumeShogiProps = {
  difficulty: TsumeShogiDifficulty;
  problemId: ProblemId;
};

export function PlayableTsumeShogi({
  difficulty,
  problemId,
}: PlayableTsumeShogiProps) {
  const requestedProblem = selectTsumeShogiProblemById(difficulty, problemId);
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useTsumeShogiPlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
  );
  const { poolReference } = play;
  // 記録には遊んだ問題の問題集の位置も残す。問題が替わるまでは同じ関数を渡し、記録を作り直さない。
  const createPlayRecord = useCallback(
    (
      completed: CompletedGamePlay<
        TsumeShogiDifficulty,
        TsumeShogiProblemIdentity,
        TsumeShogiResult
      >,
    ) =>
      createTsumeShogiPlayRecord({
        ...completed,
        poolReference,
        workload: completed.result.workload,
      }),
    [poolReference],
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: tsumeShogiCatalogEntry,
    play,
    playRecordDefinition: tsumeShogiPlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createTsumeShogiPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createTsumeShogiDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        poolReference,
        problem: play.session.problem,
        buildRevision,
      });
    },
  });

  return (
    <>
      <TsumeShogiPlay
        {...screenProps}
        plies={play.plies}
        phase={play.phase}
        playedPlies={play.playedPlies}
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
