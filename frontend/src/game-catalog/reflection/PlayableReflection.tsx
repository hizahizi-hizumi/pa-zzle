import { useMemo, useState } from "react";

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

/** 最初に遊ぶ問題の identity。記録の問題を、その記録の難易度として遊び直すときに渡す。記録は通常どおり保存する。 */
type ReflectionInitialProblem = {
  identity: ReflectionProblemIdentity;
};

type PlayableReflectionProps = {
  difficulty: ReflectionDifficulty;
  initialProblem?: ReflectionInitialProblem;
};

export function PlayableReflection({
  difficulty,
  initialProblem,
}: PlayableReflectionProps) {
  const play = useReflectionPlay(difficulty, initialProblem?.identity);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      // 評価（`result`）は作業の量がある問題集の問題でだけ得られるので、評価できたプレイだけを記録する。
      play.result && play.completedAt !== null
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
        difficultyLabel={getReflectionDifficultyLabel(difficulty)}
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
