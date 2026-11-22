import { magicSquareCatalogEntry } from "@/app/game-integration/magic-square/magic-square-catalog-entry";
import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/app/game-integration/playable-game";
import { createMagicSquareDiagnosticSnapshot } from "@/games/magic-square/diagnostics";
import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import {
  type MagicSquareResult,
  useMagicSquarePlay,
} from "@/games/magic-square/play/use-magic-square-play";
import { createMagicSquarePlayAttemptProgress } from "@/games/magic-square/play-attempt";
import {
  createMagicSquarePlayRecord,
  magicSquarePlayRecordDefinition,
} from "@/games/magic-square/play-record";
import type { MagicSquareProblemIdentity } from "@/games/magic-square/problem/problem";
import { selectMagicSquareProblemById } from "@/games/magic-square/problem-selection";
import { MagicSquareDiagnostics } from "@/games/magic-square/ui/MagicSquareDiagnostics";
import { MagicSquarePlay } from "@/games/magic-square/ui/MagicSquarePlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableMagicSquareProps = {
  difficulty: MagicSquareDifficulty;
  problemId: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    MagicSquareDifficulty,
    MagicSquareProblemIdentity,
    MagicSquareResult
  >,
) {
  return createMagicSquarePlayRecord({
    ...completed,
    workload: completed.result.workload,
  });
}

export function PlayableMagicSquare({
  difficulty,
  problemId,
}: PlayableMagicSquareProps) {
  const requestedProblem = selectMagicSquareProblemById(difficulty, problemId);
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useMagicSquarePlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: magicSquareCatalogEntry,
    play,
    playRecordDefinition: magicSquarePlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createMagicSquarePlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createMagicSquareDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <MagicSquarePlay
        {...screenProps}
        givens={play.givens}
        board={play.board}
        selectedCellIndex={play.selectedCellIndex}
        lineEvaluations={play.lineEvaluations}
        valueStates={play.valueStates}
        withdrawalCount={play.withdrawalCount}
        onSelectCell={play.selectCell}
        onEnterValue={play.enterValue}
        canUndo={play.canUndo}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <MagicSquareDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
