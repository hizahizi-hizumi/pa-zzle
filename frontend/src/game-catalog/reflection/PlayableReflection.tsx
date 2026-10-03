import { useMemo, useState } from "react";

import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
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
};

export function PlayableReflection({ difficulty }: PlayableReflectionProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectReflectionProblemById(difficulty, problemId),
  );
  const play = useReflectionPlay(difficulty, requestedProblem);
  useProblemIdQuerySync(play.problemIdentity);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
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
            poolReference: play.poolReference,
            buildRevision,
          })
        : null,
    [difficulty, diagnosticsOpen, play.problemIdentity, play.poolReference],
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
