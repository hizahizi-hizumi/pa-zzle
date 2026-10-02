import { useCallback } from "react";

import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { tsumeShogiCatalogEntry } from "@/game-catalog/tsume-shogi/tsume-shogi-catalog-entry";
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
