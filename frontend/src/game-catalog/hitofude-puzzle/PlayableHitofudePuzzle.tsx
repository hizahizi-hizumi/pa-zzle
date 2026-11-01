import { hitofudePuzzleCatalogEntry } from "@/game-catalog/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { createHitofudePuzzleDiagnosticSnapshot } from "@/games/hitofude-puzzle/diagnostics";
import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import {
  type HitofudePuzzleResult,
  useHitofudePuzzlePlay,
} from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import { createHitofudePuzzlePlayAttemptProgress } from "@/games/hitofude-puzzle/play-attempt";
import {
  createHitofudePuzzlePlayRecord,
  hitofudePuzzlePlayRecordDefinition,
} from "@/games/hitofude-puzzle/play-record";
import type { HitofudePuzzleProblemIdentity } from "@/games/hitofude-puzzle/problem/problem";
import { selectHitofudePuzzleProblemById } from "@/games/hitofude-puzzle/problem-selection";
import { HitofudePuzzleDiagnostics } from "@/games/hitofude-puzzle/ui/HitofudePuzzleDiagnostics";
import { HitofudePuzzlePlay } from "@/games/hitofude-puzzle/ui/HitofudePuzzlePlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableHitofudePuzzleProps = {
  difficulty: HitofudePuzzleDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    HitofudePuzzleDifficulty,
    HitofudePuzzleProblemIdentity,
    HitofudePuzzleResult
  >,
) {
  return createHitofudePuzzlePlayRecord({
    ...completed,
    workload: completed.result.workload,
  });
}

export function PlayableHitofudePuzzle({
  difficulty,
  avoidedProblemId,
}: PlayableHitofudePuzzleProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectHitofudePuzzleProblemById(difficulty, problemId),
  );
  const play = useHitofudePuzzlePlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: hitofudePuzzleCatalogEntry,
    play,
    playRecordDefinition: hitofudePuzzlePlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createHitofudePuzzlePlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createHitofudePuzzleDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        problem: play.board,
        buildRevision,
      });
    },
  });

  return (
    <>
      <HitofudePuzzlePlay
        {...screenProps}
        board={play.board}
        path={play.path}
        isDeadEnd={play.isDeadEnd}
        blockedMove={play.blockedMove}
        pathNotice={play.pathNotice}
        backtrackCount={play.backtrackCount}
        undoCount={play.undoCount}
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
        <HitofudePuzzleDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
