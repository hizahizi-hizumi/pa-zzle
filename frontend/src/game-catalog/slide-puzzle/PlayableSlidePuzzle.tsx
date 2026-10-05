import { useMemo, useState } from "react";
import { useGameNavigation } from "@/game-catalog/game-navigation";
import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { useRecordResultNavigation } from "@/game-catalog/record-result-navigation";
import { slidePuzzleCatalogEntry } from "@/game-catalog/slide-puzzle/slide-puzzle-catalog-entry";
import type { ProblemId } from "@/games/problem-id";
import { createSlidePuzzleDiagnosticSnapshot } from "@/games/slide-puzzle/diagnostics";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { useSlidePuzzlePlay } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { createSlidePuzzlePlayAttemptProgress } from "@/games/slide-puzzle/play-attempt";
import {
  createSlidePuzzlePlayRecord,
  slidePuzzlePlayRecordDefinition,
} from "@/games/slide-puzzle/play-record";
import { selectSlidePuzzleProblemById } from "@/games/slide-puzzle/problem-selection";
import { slidePuzzlePlayRecordDisplay } from "@/games/slide-puzzle/ui/play-record-display";
import { SlidePuzzleDiagnostics } from "@/games/slide-puzzle/ui/SlidePuzzleDiagnostics";
import { SlidePuzzlePlay } from "@/games/slide-puzzle/ui/SlidePuzzlePlay";
import {
  buildRevision,
  internalDiagnosticsAvailable,
} from "@/lib/internal-diagnostics";
import { usePlayAttemptRecord } from "@/records/hooks/use-play-attempt-record";
import { useSavePlayRecord } from "@/records/hooks/use-save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

type PlayableSlidePuzzleProps = {
  difficulty: SlidePuzzleDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableSlidePuzzle({
  difficulty,
  avoidedProblemId,
}: PlayableSlidePuzzleProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectSlidePuzzleProblemById(difficulty, problemId),
  );
  const play = useSlidePuzzlePlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  useProblemIdQuerySync(play.problemIdentity);
  const navigation = useGameNavigation(slidePuzzleCatalogEntry);
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
  const navigatesToRecordResult = useRecordResultNavigation(
    play.progress === "result",
    playRecord,
    recordOutcome,
  );
  usePlayAttemptRecord({
    gameId: slidePuzzlePlayRecordDefinition.gameId,
    startedAt: play.startedAt,
    start: { difficulty, problemIdentity: play.problemIdentity },
    finished: play.completedAt !== null,
    getProgress(abandonedAt) {
      return createSlidePuzzlePlayAttemptProgress(play.session, abandonedAt);
    },
  });
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
        progress={play.progress}
        board={play.board}
        elapsedMs={play.elapsedMs}
        moveCount={play.moveCount}
        operation={play.operation}
        // 記録の結果画面へ遷移する間は、その場の結果画面を出さず盤面を見せておく。
        result={navigatesToRecordResult ? null : play.result}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={recordOutcome}
            display={slidePuzzlePlayRecordDisplay}
          />
        }
        onSlideTile={play.slideTile}
        onSlideInDirection={play.slideInDirection}
        canRestart={play.canRestart}
        onRestart={play.restart}
        onReplay={play.replay}
        onStartNewProblem={play.startNewProblem}
        onOpenRecords={navigation.openRecords}
        onClearingComplete={play.completeClearAnimation}
        onChangeDifficulty={navigation.changeDifficulty}
        onBackToHome={navigation.backToHome}
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
