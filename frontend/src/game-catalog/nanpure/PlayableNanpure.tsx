import { useMemo, useState } from "react";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { useRecordResultNavigation } from "@/game-catalog/record-result-navigation";
import { createNanpureDiagnosticSnapshot } from "@/games/nanpure/diagnostics";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { useNanpurePlay } from "@/games/nanpure/play/use-nanpure-play";
import { createNanpurePlayAttemptProgress } from "@/games/nanpure/play-attempt";
import {
  createNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "@/games/nanpure/play-record";
import { selectNanpureProblemById } from "@/games/nanpure/problem-selection";
import { NanpureDiagnostics } from "@/games/nanpure/ui/NanpureDiagnostics";
import { NanpurePlay } from "@/games/nanpure/ui/NanpurePlay";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import type { ProblemId } from "@/games/problem-id";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { usePlayAttemptRecord } from "@/records/hooks/use-play-attempt-record";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableNanpureProps = {
  difficulty: NanpureDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableNanpure({
  difficulty,
  avoidedProblemId,
}: PlayableNanpureProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectNanpureProblemById(difficulty, problemId),
  );
  const play = useNanpurePlay(difficulty, requestedProblem, avoidedProblemId);
  useProblemIdQuerySync(play.problemIdentity);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createNanpurePlayRecord({
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
    nanpurePlayRecordDefinition,
  );
  const navigatesToRecordResult = useRecordResultNavigation(
    play.progress === "result",
    playRecord,
    recordOutcome,
  );
  usePlayAttemptRecord({
    gameId: nanpurePlayRecordDefinition.gameId,
    startedAt: play.startedAt,
    start: { difficulty, problemIdentity: play.problemIdentity },
    finished: play.completedAt !== null,
    getProgress(abandonedAt) {
      return createNanpurePlayAttemptProgress(play.session, abandonedAt);
    },
  });
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createNanpureDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <NanpurePlay
        difficulty={difficulty}
        status={play.status}
        progress={play.progress}
        clues={play.clues}
        board={play.board}
        notes={play.notes}
        selectedCellIndex={play.selectedCellIndex}
        conflictCellIndices={play.conflictCellIndices}
        mistakeCellIndices={play.mistakeCellIndices}
        completedDigits={play.completedDigits}
        notesMode={play.notesMode}
        elapsedMs={play.elapsedMs}
        mistakeCount={play.mistakeCount}
        undoCount={play.undoCount}
        canUndo={play.canUndo}
        // 記録の結果画面へ遷移する間は、その場の結果画面を出さず盤面を見せておく。
        result={navigatesToRecordResult ? null : play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={nanpurePlayRecordDisplay}
          />
        }
        onSelectCell={play.selectCell}
        onInputDigit={play.inputDigit}
        onErase={play.erase}
        onToggleNotesMode={play.toggleNotesMode}
        onUndo={play.undo}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onChangeDifficulty={() => navigate("/puzzles/nanpure")}
        onBackToHome={() => navigate("/")}
        onClearAnimationComplete={play.completeClearAnimation}
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && diagnosticsOpen && (
        <NanpureDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
