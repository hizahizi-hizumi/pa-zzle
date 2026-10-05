import { useMemo, useState } from "react";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { useRecordResultNavigation } from "@/game-catalog/record-result-navigation";
import type { ProblemId } from "@/games/problem-id";
import { createTakuzuDiagnosticSnapshot } from "@/games/takuzu/diagnostics";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { useTakuzuPlay } from "@/games/takuzu/play/use-takuzu-play";
import { createTakuzuPlayAttemptProgress } from "@/games/takuzu/play-attempt";
import {
  createTakuzuPlayRecord,
  takuzuPlayRecordDefinition,
} from "@/games/takuzu/play-record";
import { selectTakuzuProblemById } from "@/games/takuzu/problem-selection";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import { TakuzuDiagnostics } from "@/games/takuzu/ui/TakuzuDiagnostics";
import { TakuzuPlay } from "@/games/takuzu/ui/TakuzuPlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { usePlayAttemptRecord } from "@/records/hooks/use-play-attempt-record";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableTakuzuProps = {
  difficulty: TakuzuDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableTakuzu({
  difficulty,
  avoidedProblemId,
}: PlayableTakuzuProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectTakuzuProblemById(difficulty, problemId),
  );
  const play = useTakuzuPlay(difficulty, requestedProblem, avoidedProblemId);
  useProblemIdQuerySync(play.problemIdentity);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createTakuzuPlayRecord({
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
    takuzuPlayRecordDefinition,
  );
  const navigatesToRecordResult = useRecordResultNavigation(
    play.progress === "result",
    playRecord,
    recordOutcome,
  );
  usePlayAttemptRecord({
    gameId: takuzuPlayRecordDefinition.gameId,
    startedAt: play.startedAt,
    start: { difficulty, problemIdentity: play.problemIdentity },
    finished: play.completedAt !== null,
    getProgress(abandonedAt) {
      return createTakuzuPlayAttemptProgress(play.session, abandonedAt);
    },
  });
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createTakuzuDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <TakuzuPlay
        difficulty={play.difficulty}
        size={play.size}
        cells={play.cells}
        lineViolations={play.lineViolations}
        progress={play.progress}
        correctionCount={play.correctionCount}
        undoCount={play.undoCount}
        canUndo={play.canUndo}
        elapsedMs={play.elapsedMs}
        // 記録の結果画面へ遷移する間は、その場の結果画面を出さず盤面を見せておく。
        result={navigatesToRecordResult ? null : play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={takuzuPlayRecordDisplay}
          />
        }
        onCycleCell={play.cycleCell}
        onPlaceCell={play.placeCell}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onClearAnimationComplete={play.completeClearAnimation}
        onChangeDifficulty={() => navigate("/puzzles/takuzu")}
        onBackToHome={() => navigate("/")}
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && diagnosticsOpen && (
        <TakuzuDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
