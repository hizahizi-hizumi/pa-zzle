import { usePlayableGame } from "@/app/game-integration/playable-game";
import { waterSortCatalogEntry } from "@/app/game-integration/water-sort/water-sort-catalog-entry";
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
import { WaterSortDiagnostics } from "@/games/water-sort/ui/WaterSortDiagnostics";
import { WaterSortPlay } from "@/games/water-sort/ui/WaterSortPlay";

type PlayableWaterSortProps = {
  difficulty: WaterSortDifficulty;
  problemId: ProblemId;
};

export function PlayableWaterSort({
  difficulty,
  problemId,
}: PlayableWaterSortProps) {
  const requestedProblem = selectWaterSortProblemById(difficulty, problemId);
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useWaterSortPlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: waterSortCatalogEntry,
    play,
    playRecordDefinition: waterSortPlayRecordDefinition,
    createPlayRecord: createWaterSortPlayRecord,
    createPlayAttemptProgress: createWaterSortPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createWaterSortDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <WaterSortPlay
        {...screenProps}
        state={play.state}
        moveCount={play.moveCount}
        undoCount={play.undoCount}
        canUndo={play.canUndo}
        isDeadlocked={play.isDeadlocked}
        sourceBottleIndex={play.sourceBottleIndex}
        operation={play.operation}
        onSelectBottle={play.selectBottle}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <WaterSortDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
