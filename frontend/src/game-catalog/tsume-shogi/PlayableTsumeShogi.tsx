import { useMemo, useState } from "react";

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
};

export function PlayableTsumeShogi({ difficulty }: PlayableTsumeShogiProps) {
  const play = useTsumeShogiPlay(difficulty);
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
        onWrongLine={play.onWrongLine}
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
        result={play.result}
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
        onReturnToDecision={play.returnToDecision}
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
