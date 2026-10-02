import { useMemo, useState } from "react";

import { createWaterSortDiagnosticSnapshot } from "@/games/water-sort/diagnostics";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import { useWaterSortPlay } from "@/games/water-sort/play/use-water-sort-play";
import {
  createWaterSortPlayAttempt,
  createWaterSortPlayAttemptProgress,
} from "@/games/water-sort/play-attempt";
import {
  createWaterSortPlayRecord,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import type { WaterSortGeneratedProblem } from "@/games/water-sort/problem/problem";
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
  initialProblem?: WaterSortGeneratedProblem;
};

export function PlayableWaterSort({
  difficulty,
  initialProblem,
}: PlayableWaterSortProps) {
  const play = useWaterSortPlay(difficulty, initialProblem);
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
  const playAttempt = useMemo(
    () =>
      createWaterSortPlayAttempt({
        difficulty,
        problemIdentity: play.problemIdentity,
        startedAt: play.startedAt,
      }),
    [difficulty, play.problemIdentity, play.startedAt],
  );
  usePlayAttemptRecord(playAttempt, {
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
        result={play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={waterSortPlayRecordDisplay}
          />
        }
        onSelectBottle={play.selectBottle}
        onUndo={play.undo}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onClearingPourComplete={play.completeClearingPour}
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
