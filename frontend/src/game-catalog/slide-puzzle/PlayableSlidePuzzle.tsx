import { useMemo, useState } from "react";

import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { createSlidePuzzleDiagnosticSnapshot } from "@/games/slide-puzzle/diagnostics";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { useSlidePuzzlePlay } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import {
  createSlidePuzzlePlayRecord,
  slidePuzzlePlayRecordDefinition,
} from "@/games/slide-puzzle/play-record";
import type { SlidePuzzleGeneratedProblem } from "@/games/slide-puzzle/problem/problem";
import { selectSlidePuzzleProblemById } from "@/games/slide-puzzle/problem-selection";
import { slidePuzzlePlayRecordDisplay } from "@/games/slide-puzzle/ui/play-record-display";
import { SlidePuzzleDiagnostics } from "@/games/slide-puzzle/ui/SlidePuzzleDiagnostics";
import { SlidePuzzlePlay } from "@/games/slide-puzzle/ui/SlidePuzzlePlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";
import { useNavigate } from "@/router";

type PlayableSlidePuzzleProps = {
  difficulty: SlidePuzzleDifficulty;
  /** 記録から復元した問題。渡すとその問題で始め、URL の問題 ID とは結ばない。 */
  initialProblem?: SlidePuzzleGeneratedProblem;
};

export function PlayableSlidePuzzle({
  difficulty,
  initialProblem,
}: PlayableSlidePuzzleProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectSlidePuzzleProblemById(difficulty, problemId),
  );
  const play = useSlidePuzzlePlay(
    difficulty,
    initialProblem ?? requestedProblem,
  );
  useProblemIdQuerySync(initialProblem ? null : play.problemIdentity);
  const navigate = useNavigate();
  const playRecord = useMemo(
    () =>
      play.result && play.completedAt !== null
        ? createSlidePuzzlePlayRecord({
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
    slidePuzzlePlayRecordDefinition,
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const diagnostics = internalDiagnosticsAvailable
    ? createSlidePuzzleDiagnosticSnapshot({
        difficulty: play.difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      })
    : null;

  return (
    <>
      <SlidePuzzlePlay
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
            display={slidePuzzlePlayRecordDisplay}
          />
        }
        onSlideTile={play.slideTile}
        onSlideByKeyboard={play.slideByKeyboard}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={() => navigate("/records")}
        onClearingComplete={play.completeClearing}
        onChangeDifficulty={() => navigate("/puzzles/slide-puzzle")}
        onBackToHome={() => navigate("/")}
        onOpenDiagnostics={
          diagnostics ? () => setDiagnosticsOpen(true) : undefined
        }
      />
      {diagnostics && diagnosticsOpen && (
        <SlidePuzzleDiagnostics
          snapshot={diagnostics}
          onClose={() => setDiagnosticsOpen(false)}
        />
      )}
    </>
  );
}
