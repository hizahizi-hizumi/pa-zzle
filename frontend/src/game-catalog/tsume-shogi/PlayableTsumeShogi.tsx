import { useMemo, useState } from "react";

import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { useRecordResultNavigation } from "@/game-catalog/record-result-navigation";
import type { ProblemId } from "@/games/problem-id";
import { createTsumeShogiDiagnosticSnapshot } from "@/games/tsume-shogi/diagnostics";
import {
  getTsumeShogiDifficultyLabel,
  type TsumeShogiDifficulty,
} from "@/games/tsume-shogi/difficulty";
import { useTsumeShogiPlay } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  createTsumeShogiPlayRecord,
  tsumeShogiPlayRecordDefinition,
} from "@/games/tsume-shogi/play-record";
import { selectTsumeShogiProblemById } from "@/games/tsume-shogi/problem-selection";
import { tsumeShogiPlayRecordDisplay } from "@/games/tsume-shogi/ui/play-record-display";
import { TsumeShogiDiagnostics } from "@/games/tsume-shogi/ui/TsumeShogiDiagnostics";
import { TsumeShogiPlay } from "@/games/tsume-shogi/ui/TsumeShogiPlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
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
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createTsumeShogiPlayRecord({
            difficulty,
            problemIdentity: play.problemIdentity,
            poolReference: play.poolReference,
            workload: play.result.workload,
            startedAt: play.startedAt,
            completedAt: play.completedAt,
            result: play.result,
          })
        : null,
    [
      difficulty,
      play.completedAt,
      play.poolReference,
      play.problemIdentity,
      play.result,
      play.startedAt,
    ],
  );
  const recordOutcome = useSavePlayRecord(
    playRecord,
    tsumeShogiPlayRecordDefinition,
  );
  const navigatesToRecordResult = useRecordResultNavigation(
    play.progress === "result",
    playRecord,
    recordOutcome,
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = useMemo(
    () =>
      internalDiagnosticsAvailable && diagnosticsOpen
        ? createTsumeShogiDiagnosticSnapshot({
            difficulty,
            problemIdentity: play.problemIdentity,
            poolReference: play.poolReference,
            problem: play.problem,
            buildRevision,
          })
        : null,
    [
      difficulty,
      diagnosticsOpen,
      play.problemIdentity,
      play.poolReference,
      play.problem,
    ],
  );

  return (
    <>
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
        // 記録の結果画面へ遷移する間は、その場の結果画面を出さず盤面を見せておく。
        result={navigatesToRecordResult ? null : play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={tsumeShogiPlayRecordDisplay}
          />
        }
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
        onOpenRecords={() => navigate("/records")}
        onChangeDifficulty={() => navigate("/puzzles/tsume-shogi")}
        onBackToHome={() => navigate("/")}
        onOpenDiagnostics={
          internalDiagnosticsAvailable
            ? () => setDiagnosticsOpen(true)
            : undefined
        }
      />
      {diagnostics && (
        <TsumeShogiDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
