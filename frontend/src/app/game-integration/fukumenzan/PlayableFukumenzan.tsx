import { fukumenzanCatalogEntry } from "@/app/game-integration/fukumenzan/fukumenzan-catalog-entry";
import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/app/game-integration/playable-game";
import { createFukumenzanDiagnosticSnapshot } from "@/games/fukumenzan/diagnostics";
import type { FukumenzanDifficulty } from "@/games/fukumenzan/difficulty";
import {
  type FukumenzanResult,
  useFukumenzanPlay,
} from "@/games/fukumenzan/play/use-fukumenzan-play";
import { createFukumenzanPlayAttemptProgress } from "@/games/fukumenzan/play-attempt";
import {
  createFukumenzanPlayRecord,
  fukumenzanPlayRecordDefinition,
} from "@/games/fukumenzan/play-record";
import type { FukumenzanProblemIdentity } from "@/games/fukumenzan/problem/problem";
import { selectFukumenzanProblemById } from "@/games/fukumenzan/problem-selection";
import { FukumenzanDiagnostics } from "@/games/fukumenzan/ui/FukumenzanDiagnostics";
import { FukumenzanPlay } from "@/games/fukumenzan/ui/FukumenzanPlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableFukumenzanProps = {
  difficulty: FukumenzanDifficulty;
  problemId: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    FukumenzanDifficulty,
    FukumenzanProblemIdentity,
    FukumenzanResult
  >,
) {
  return createFukumenzanPlayRecord({
    ...completed,
    workload: completed.result.workload,
  });
}

export function PlayableFukumenzan({
  difficulty,
  problemId,
}: PlayableFukumenzanProps) {
  const requestedProblem = selectFukumenzanProblemById(difficulty, problemId);
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useFukumenzanPlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: fukumenzanCatalogEntry,
    play,
    playRecordDefinition: fukumenzanPlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createFukumenzanPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createFukumenzanDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <FukumenzanPlay
        {...screenProps}
        problem={play.problem}
        letters={play.letters}
        puzzleState={play.puzzleState}
        leadingZeroLetters={play.leadingZeroLetters}
        miscalculatedColumns={play.miscalculatedColumns}
        undoCount={play.undoCount}
        crossUndoNotice={play.crossUndoNotice}
        operation={play.operation}
        canUndo={play.canUndo}
        canRestart={play.canRestart}
        onPlaceDigit={play.placeDigit}
        onReturnDigit={play.returnDigit}
        onToggleCross={play.toggleCross}
        onUndo={play.undo}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <FukumenzanDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
