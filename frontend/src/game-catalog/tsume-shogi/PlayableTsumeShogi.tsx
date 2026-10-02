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
import type { TsumeShogiIdentifiedProblem } from "@/games/tsume-shogi/problem/problem";
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

/**
 * 最初に遊ぶ問題を指定する。
 * - `replay`: 記録の問題を、その記録の難易度として遊び直す。記録は通常どおり保存する。
 * - `blind-comparison`: 人間の遊び比べ用に指定した問題。難易度を伏せ、記録を保存しない。
 */
type TsumeShogiInitialProblem = {
  problem: TsumeShogiIdentifiedProblem;
  purpose: "replay" | "blind-comparison";
};

type PlayableTsumeShogiProps = {
  difficulty: TsumeShogiDifficulty;
  initialProblem?: TsumeShogiInitialProblem;
};

const BLIND_COMPARISON_DIFFICULTY_LABEL = "問題指定";

export function PlayableTsumeShogi({
  difficulty,
  initialProblem,
}: PlayableTsumeShogiProps) {
  const play = useTsumeShogiPlay(difficulty, initialProblem?.problem);
  const navigate = useNavigate();
  // 別の問題へ進むと指定した問題ではなくなるので、難易度を出し、記録も保存する。
  const isBlindComparison =
    initialProblem?.purpose === "blind-comparison" &&
    play.problemSource === "given";
  const playRecord = useMemo(
    () =>
      // 評価（`result`）は作業の量がある問題集の問題でだけ得られるので、評価できたプレイだけを記録する。
      !isBlindComparison &&
      play.result &&
      play.poolReference &&
      play.completedAt !== null
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
      isBlindComparison,
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
            problem: play.problem,
            buildRevision,
          })
        : null,
    [difficulty, diagnosticsOpen, play.problemIdentity, play.problem],
  );

  return (
    <>
      <TsumeShogiPlay
        difficultyLabel={
          isBlindComparison
            ? BLIND_COMPARISON_DIFFICULTY_LABEL
            : getTsumeShogiDifficultyLabel(difficulty)
        }
        plies={play.plies}
        progress={play.progress}
        phase={play.phase}
        onWrongLine={play.onWrongLine}
        boardPieces={play.boardPieces}
        attackerHand={play.attackerHand}
        shownMoves={play.shownMoves}
        selection={play.selection}
        promotionChoice={play.promotionChoice}
        rejection={play.rejection}
        elapsedMs={play.elapsedMs}
        canUndo={play.canUndo}
        canRestart={play.canRestart}
        sessionResult={play.sessionResult}
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
