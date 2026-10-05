import { useMemo, useState } from "react";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { useRecordResultNavigation } from "@/game-catalog/record-result-navigation";
import type { ProblemId } from "@/games/problem-id";
import { createWaterSortDiagnosticSnapshot } from "@/games/water-sort/diagnostics";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { useWaterSortPlay } from "@/games/water-sort/play/use-water-sort-play";
import { createWaterSortPlayAttemptProgress } from "@/games/water-sort/play-attempt";
import {
  createWaterSortPlayRecord,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import { selectWaterSortProblemById } from "@/games/water-sort/problem-selection";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { WaterSortDiagnostics } from "@/games/water-sort/ui/WaterSortDiagnostics";
import { WaterSortPlay } from "@/games/water-sort/ui/WaterSortPlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { usePlayAttemptRecord } from "@/records/hooks/use-play-attempt-record";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableWaterSortProps = {
  difficulty: WaterSortDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableWaterSort({
  difficulty,
  avoidedProblemId,
}: PlayableWaterSortProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectWaterSortProblemById(difficulty, problemId),
  );
  const play = useWaterSortPlay(difficulty, requestedProblem, avoidedProblemId);
  useProblemIdQuerySync(play.problemIdentity);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createWaterSortPlayRecord({
            difficulty,
            problemIdentity: play.problemIdentity,
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
    waterSortPlayRecordDefinition,
  );
  const navigatesToRecordResult = useRecordResultNavigation(
    play.progress === "result",
    playRecord,
    recordOutcome,
  );
  usePlayAttemptRecord({
    gameId: waterSortPlayRecordDefinition.gameId,
    startedAt: play.startedAt,
    start: { difficulty, problemIdentity: play.problemIdentity },
    finished: play.completedAt !== null,
    getProgress(abandonedAt) {
      return createWaterSortPlayAttemptProgress(play.session, abandonedAt);
    },
  });
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createWaterSortDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <WaterSortPlay
        difficulty={play.difficulty}
        status={play.status}
        progress={play.progress}
        state={play.state}
        elapsedMs={play.elapsedMs}
        moveCount={play.moveCount}
        undoCount={play.undoCount}
        canUndo={play.canUndo}
        isDeadlocked={play.isDeadlocked}
        sourceBottleIndex={play.sourceBottleIndex}
        operation={play.operation}
        // 記録の結果画面へ遷移する間は、その場の結果画面を出さず盤面を見せておく。
        result={navigatesToRecordResult ? null : play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={waterSortPlayRecordDisplay}
          />
        }
        onSelectBottle={play.selectBottle}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onClearingPourComplete={play.completeClearAnimation}
        onChangeDifficulty={() => navigate("/puzzles/water-sort")}
        onBackToHome={() => navigate("/")}
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && diagnosticsOpen && (
        <WaterSortDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
