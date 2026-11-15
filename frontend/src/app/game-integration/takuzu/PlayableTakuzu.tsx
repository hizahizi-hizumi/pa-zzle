import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/app/game-integration/playable-game";
import { takuzuCatalogEntry } from "@/app/game-integration/takuzu/takuzu-catalog-entry";
import type { ProblemId } from "@/games/problem-id";
import { createTakuzuDiagnosticSnapshot } from "@/games/takuzu/diagnostics";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import {
  type TakuzuResult,
  useTakuzuPlay,
} from "@/games/takuzu/play/use-takuzu-play";
import { createTakuzuPlayAttemptProgress } from "@/games/takuzu/play-attempt";
import {
  createTakuzuPlayRecord,
  takuzuPlayRecordDefinition,
} from "@/games/takuzu/play-record";
import type { TakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { selectTakuzuProblemById } from "@/games/takuzu/problem-selection";
import { TakuzuDiagnostics } from "@/games/takuzu/ui/TakuzuDiagnostics";
import { TakuzuPlay } from "@/games/takuzu/ui/TakuzuPlay";

type PlayableTakuzuProps = {
  difficulty: TakuzuDifficulty;
  problemId: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    TakuzuDifficulty,
    TakuzuProblemIdentity,
    TakuzuResult
  >,
) {
  return createTakuzuPlayRecord({
    ...completed,
    workload: completed.result.workload,
  });
}

export function PlayableTakuzu({ difficulty, problemId }: PlayableTakuzuProps) {
  const requestedProblem = selectTakuzuProblemById(difficulty, problemId);
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useTakuzuPlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: takuzuCatalogEntry,
    play,
    playRecordDefinition: takuzuPlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createTakuzuPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createTakuzuDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <TakuzuPlay
        {...screenProps}
        size={play.size}
        cells={play.cells}
        lineViolations={play.lineViolations}
        correctionCount={play.correctionCount}
        undoCount={play.undoCount}
        operation={play.operation}
        canUndo={play.canUndo}
        onCycleCell={play.cycleCell}
        onPlaceCell={play.placeCell}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <TakuzuDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
