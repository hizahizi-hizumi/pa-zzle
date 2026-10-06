import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { reflectionCatalogEntry } from "@/game-catalog/reflection/reflection-catalog-entry";
import type { ProblemId } from "@/games/problem-id";
import { createReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { reflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import {
  type ReflectionResult,
  useReflectionPlay,
} from "@/games/reflection/play/use-reflection-play";
import { createReflectionPlayAttemptProgress } from "@/games/reflection/play-attempt";
import {
  createReflectionPlayRecord,
  reflectionPlayRecordDefinition,
} from "@/games/reflection/play-record";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { selectReflectionProblemById } from "@/games/reflection/problem-selection";
import { ReflectionDiagnostics } from "@/games/reflection/ui/ReflectionDiagnostics";
import { ReflectionPlay } from "@/games/reflection/ui/ReflectionPlay";

type PlayableReflectionProps = {
  difficulty: ReflectionDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    ReflectionDifficulty,
    ReflectionProblemIdentity,
    ReflectionResult
  >,
) {
  return createReflectionPlayRecord({
    ...completed,
    workload: completed.result.workload,
  });
}

export function PlayableReflection({
  difficulty,
  avoidedProblemId,
}: PlayableReflectionProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectReflectionProblemById(difficulty, problemId),
  );
  const play = useReflectionPlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: reflectionCatalogEntry,
    play,
    playRecordDefinition: reflectionPlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createReflectionPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createReflectionDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        poolReference: play.poolReference,
        buildRevision,
      });
    },
  });

  return (
    <>
      <ReflectionPlay
        {...screenProps}
        laserPathMode={reflectionLaserPathMode}
        board={play.board}
        clues={play.clues}
        inventory={play.inventory}
        stock={play.stock}
        selection={play.selection}
        laser={play.laser}
        canRestart={play.canRestart}
        onSelectCell={play.selectCell}
        onSelectStockPiece={play.selectStockPiece}
        onSelectClue={play.selectClue}
        onRemovePiece={play.removePiece}
        onClearSelection={play.clearSelection}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <ReflectionDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
