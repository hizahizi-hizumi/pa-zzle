import { hamiltonianPathCatalogEntry } from "@/game-catalog/hamiltonian-path/hamiltonian-path-catalog-entry";
import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { createHamiltonianPathDiagnosticSnapshot } from "@/games/hamiltonian-path/diagnostics";
import type { HamiltonianPathDifficulty } from "@/games/hamiltonian-path/difficulty";
import {
  type HamiltonianPathResult,
  useHamiltonianPathPlay,
} from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import { createHamiltonianPathPlayAttemptProgress } from "@/games/hamiltonian-path/play-attempt";
import {
  createHamiltonianPathPlayRecord,
  hamiltonianPathPlayRecordDefinition,
} from "@/games/hamiltonian-path/play-record";
import type { HamiltonianPathProblemIdentity } from "@/games/hamiltonian-path/problem/problem";
import { selectHamiltonianPathProblemById } from "@/games/hamiltonian-path/problem-selection";
import { HamiltonianPathDiagnostics } from "@/games/hamiltonian-path/ui/HamiltonianPathDiagnostics";
import { HamiltonianPathPlay } from "@/games/hamiltonian-path/ui/HamiltonianPathPlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableHamiltonianPathProps = {
  difficulty: HamiltonianPathDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    HamiltonianPathDifficulty,
    HamiltonianPathProblemIdentity,
    HamiltonianPathResult
  >,
) {
  return createHamiltonianPathPlayRecord({
    ...completed,
    workload: completed.result.workload,
  });
}

export function PlayableHamiltonianPath({
  difficulty,
  avoidedProblemId,
}: PlayableHamiltonianPathProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectHamiltonianPathProblemById(difficulty, problemId),
  );
  const play = useHamiltonianPathPlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: hamiltonianPathCatalogEntry,
    play,
    playRecordDefinition: hamiltonianPathPlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createHamiltonianPathPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createHamiltonianPathDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        problem: play.board,
        buildRevision,
      });
    },
  });

  return (
    <>
      <HamiltonianPathPlay
        {...screenProps}
        board={play.board}
        path={play.path}
        isDeadEnd={play.isDeadEnd}
        strandedCells={play.strandedCells}
        blockedMove={play.blockedMove}
        canUndo={play.canUndo}
        canRestart={play.canRestart}
        onBeginStroke={play.beginStroke}
        onTraceStroke={play.traceStroke}
        onEndStroke={play.endStroke}
        onMoveHeadToward={play.moveHeadToward}
        onUndo={play.undo}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <HamiltonianPathDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
