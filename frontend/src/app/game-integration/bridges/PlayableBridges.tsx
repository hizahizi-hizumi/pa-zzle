import { bridgesCatalogEntry } from "@/app/game-integration/bridges/bridges-catalog-entry";
import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/app/game-integration/playable-game";
import { useRequestedProblem } from "@/app/navigation/problem-id-query";
import { createBridgesDiagnosticSnapshot } from "@/games/bridges/diagnostics";
import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import {
  type BridgesResult,
  useBridgesPlay,
} from "@/games/bridges/play/use-bridges-play";
import { createBridgesPlayAttemptProgress } from "@/games/bridges/play-attempt";
import {
  bridgesPlayRecordDefinition,
  createBridgesPlayRecord,
} from "@/games/bridges/play-record";
import type { BridgesProblemIdentity } from "@/games/bridges/problem/problem";
import { selectBridgesProblemById } from "@/games/bridges/problem-selection";
import { BridgesDiagnostics } from "@/games/bridges/ui/BridgesDiagnostics";
import { BridgesPlay } from "@/games/bridges/ui/BridgesPlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableBridgesProps = {
  difficulty: BridgesDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    BridgesDifficulty,
    BridgesProblemIdentity,
    BridgesResult
  >,
) {
  return createBridgesPlayRecord({
    ...completed,
    workload: completed.result.workload,
  });
}

export function PlayableBridges({
  difficulty,
  avoidedProblemId,
}: PlayableBridgesProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectBridgesProblemById(difficulty, problemId),
  );
  const play = useBridgesPlay(difficulty, requestedProblem, avoidedProblemId);
  const { screenProps, diagnostics } = usePlayableGame({
    game: bridgesCatalogEntry,
    play,
    playRecordDefinition: bridgesPlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createBridgesPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createBridgesDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        problem: play.board,
        buildRevision,
      });
    },
  });

  return (
    <>
      <BridgesPlay
        {...screenProps}
        board={play.board}
        bridges={play.bridges}
        islandStatuses={play.islandStatuses}
        separatedGroupCount={play.separatedGroupCount}
        undoCount={play.undoCount}
        edgeNotice={play.edgeNotice}
        canUndo={play.canUndo}
        canRestart={play.canRestart}
        onCycleEdge={play.cycleEdge}
        onUndo={play.undo}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <BridgesDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
