import { useMemo, useState } from "react";

import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import type { ProblemId } from "@/games/problem-id";
import { createReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import {
  getReflectionDifficultyLabel,
  type ReflectionDifficulty,
} from "@/games/reflection/difficulty";
import { reflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import { useReflectionPlay } from "@/games/reflection/play/use-reflection-play";
import {
  createReflectionPlayRecord,
  reflectionPlayRecordDefinition,
} from "@/games/reflection/play-record";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { selectReflectionProblemById } from "@/games/reflection/problem-selection";
import { reflectionPlayRecordDisplay } from "@/games/reflection/ui/play-record-display";
import { ReflectionDiagnostics } from "@/games/reflection/ui/ReflectionDiagnostics";
import { ReflectionPlay } from "@/games/reflection/ui/ReflectionPlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableReflectionProps = {
  difficulty: ReflectionDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
  /**
   * 人間の遊び比べ用に identity で指定した問題。最初の1問だけこの問題を出し、難易度を伏せて記録を保存しない。
   * URL の問題 ID とは結ばない。
   */
  blindComparisonProblemIdentity?: ReflectionProblemIdentity;
};

const BLIND_COMPARISON_DIFFICULTY_LABEL = "問題指定";

export function PlayableReflection({
  difficulty,
  avoidedProblemId,
  blindComparisonProblemIdentity,
}: PlayableReflectionProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectReflectionProblemById(difficulty, problemId),
  );
  const play = useReflectionPlay(
    difficulty,
    blindComparisonProblemIdentity ?? requestedProblem?.identity,
    avoidedProblemId,
  );
  useProblemIdQuerySync(
    blindComparisonProblemIdentity ? null : play.problemIdentity,
  );
  const navigate = useNavigate();
  // 別の問題へ進むと指定した問題ではなくなるので、難易度を出し、記録も保存する。
  const isBlindComparison =
    blindComparisonProblemIdentity !== undefined &&
    play.problemSource === "given";
  const playRecord = useMemo(
    () =>
      // 評価（`result`）は作業の量がある問題集の問題でだけ得られるので、評価できたプレイだけを記録する。
      !isBlindComparison && play.result && play.completedAt !== null
        ? createReflectionPlayRecord({
            difficulty,
            problemIdentity: play.problemIdentity,
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
      play.problemIdentity,
      play.result,
      play.startedAt,
    ],
  );
  const recordOutcome = useSavePlayRecord(
    playRecord,
    reflectionPlayRecordDefinition,
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = useMemo(
    () =>
      internalDiagnosticsAvailable && diagnosticsOpen
        ? createReflectionDiagnosticSnapshot({
            difficulty,
            problemIdentity: play.problemIdentity,
            buildRevision,
          })
        : null,
    [difficulty, diagnosticsOpen, play.problemIdentity],
  );

  return (
    <>
      <ReflectionPlay
        difficultyLabel={
          isBlindComparison
            ? BLIND_COMPARISON_DIFFICULTY_LABEL
            : getReflectionDifficultyLabel(difficulty)
        }
        laserPathMode={reflectionLaserPathMode}
        progress={play.progress}
        board={play.board}
        clues={play.clues}
        inventory={play.inventory}
        stock={play.stock}
        selection={play.selection}
        laser={play.laser}
        elapsedMs={play.elapsedMs}
        canRestart={play.canRestart}
        sessionResult={play.sessionResult}
        result={play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={reflectionPlayRecordDisplay}
          />
        }
        onTapCell={play.tapCell}
        onTapStock={play.tapStock}
        onTapClue={play.tapClue}
        onRemovePiece={play.removePiece}
        onClearSelection={play.clearSelection}
        onRestart={play.restart}
        onReplay={play.replay}
        onClearAnimationComplete={play.completeClearAnimation}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onChangeDifficulty={() => navigate("/puzzles/reflection")}
        onBackToHome={() => navigate("/")}
        onOpenDiagnostics={
          internalDiagnosticsAvailable
            ? () => setDiagnosticsOpen(true)
            : undefined
        }
      />
      {diagnostics && (
        <ReflectionDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
