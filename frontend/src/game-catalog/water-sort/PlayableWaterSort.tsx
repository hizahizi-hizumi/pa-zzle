import { usePlayableGame } from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { waterSortCatalogEntry } from "@/game-catalog/water-sort/water-sort-catalog-entry";
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
