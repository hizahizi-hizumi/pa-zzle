import { useMemo, useState } from "react";

import { createFifteenPuzzleDiagnosticSnapshot } from "@/games/fifteen-puzzle/diagnostics";
import type { FifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/difficulty";
import { useFifteenPuzzlePlay } from "@/games/fifteen-puzzle/play/use-fifteen-puzzle-play";
import {
  createFifteenPuzzlePlayRecord,
  fifteenPuzzlePlayRecordDefinition,
} from "@/games/fifteen-puzzle/play-record";
import type { FifteenPuzzleGeneratedProblem } from "@/games/fifteen-puzzle/problem/problem";
import { FifteenPuzzleDiagnostics } from "@/games/fifteen-puzzle/ui/FifteenPuzzleDiagnostics";
import { FifteenPuzzlePlay } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay";
import { fifteenPuzzlePlayRecordDisplay } from "@/games/fifteen-puzzle/ui/play-record-display";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableFifteenPuzzleProps = {
  difficulty: FifteenPuzzleDifficulty;
  initialProblem?: FifteenPuzzleGeneratedProblem;
};

export function PlayableFifteenPuzzle({
  difficulty,
  initialProblem,
}: PlayableFifteenPuzzleProps) {
  const play = useFifteenPuzzlePlay(difficulty, initialProblem);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createFifteenPuzzlePlayRecord({
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
    fifteenPuzzlePlayRecordDefinition,
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createFifteenPuzzleDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <FifteenPuzzlePlay
        difficulty={play.difficulty}
        status={play.status}
        progress={play.progress}
        board={play.board}
        elapsedMs={play.elapsedMs}
        moveCount={play.moveCount}
        operation={play.operation}
        result={play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={fifteenPuzzlePlayRecordDisplay}
          />
        }
        onSlideTile={play.slideTile}
        onSlideByKeyboard={play.slideByKeyboard}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onClearingComplete={play.completeClearing}
        onChangeDifficulty={() => navigate("/puzzles/fifteen-puzzle")}
        onBackToHome={() => navigate("/")}
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && diagnosticsOpen && (
        <FifteenPuzzleDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
