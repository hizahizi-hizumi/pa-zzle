import { useMemo } from "react";
import { usePlayableGame } from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { waterSortCatalogEntry } from "@/game-catalog/water-sort/water-sort-catalog-entry";
import type { Issue690BoardSnapshot } from "@/games/issue690-board-snapshot";
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
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
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
  const issue690BoardSnapshot = useMemo<
    Issue690BoardSnapshot | undefined
  >(() => {
    if (play.status !== "cleared") return undefined;
    return {
      gameId: "water-sort",
      bottles: play.state,
      palette: Array.from(
        { length: play.problemIdentity.conditions.colorCount },
        (_, color) => getWaterColorView(color).color,
      ),
      lastMove:
        play.operation?.type === "poured" && play.operation.isClearingMove
          ? {
              sourceBottleIndex: play.operation.sourceBottleIndex,
              destinationBottleIndex: play.operation.destinationBottleIndex,
            }
          : null,
      reconstructed: false,
    };
  }, [
    play.status,
    play.state,
    play.operation,
    play.problemIdentity.conditions.colorCount,
  ]);
  const { screenProps, diagnostics } = usePlayableGame({
    issue690BoardSnapshot,
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
