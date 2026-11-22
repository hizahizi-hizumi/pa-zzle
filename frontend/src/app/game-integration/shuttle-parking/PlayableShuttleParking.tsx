import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/app/game-integration/playable-game";
import { shuttleParkingCatalogEntry } from "@/app/game-integration/shuttle-parking/shuttle-parking-catalog-entry";
import type { ProblemId } from "@/games/problem-id";
import { createShuttleParkingDiagnosticSnapshot } from "@/games/shuttle-parking/diagnostics";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import {
  type ShuttleParkingResult,
  useShuttleParkingPlay,
} from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import { createShuttleParkingPlayAttemptProgress } from "@/games/shuttle-parking/play-attempt";
import {
  createShuttleParkingPlayRecord,
  shuttleParkingPlayRecordDefinition,
} from "@/games/shuttle-parking/play-record";
import type { ShuttleParkingProblemIdentity } from "@/games/shuttle-parking/problem/problem";
import { selectShuttleParkingProblemById } from "@/games/shuttle-parking/problem-selection";
import { ShuttleParkingDiagnostics } from "@/games/shuttle-parking/ui/ShuttleParkingDiagnostics";
import { ShuttleParkingPlay } from "@/games/shuttle-parking/ui/ShuttleParkingPlay";

type PlayableShuttleParkingProps = {
  difficulty: ShuttleParkingDifficulty;
  problemId: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    ShuttleParkingDifficulty,
    ShuttleParkingProblemIdentity,
    ShuttleParkingResult
  >,
) {
  return createShuttleParkingPlayRecord({
    ...completed,
    speedReference: completed.result.speedReference,
  });
}

export function PlayableShuttleParking({
  difficulty,
  problemId,
}: PlayableShuttleParkingProps) {
  const requestedProblem = selectShuttleParkingProblemById(
    difficulty,
    problemId,
  );
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useShuttleParkingPlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: shuttleParkingCatalogEntry,
    play,
    playRecordDefinition: shuttleParkingPlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createShuttleParkingPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createShuttleParkingDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <ShuttleParkingPlay
        {...screenProps}
        problem={play.problem}
        state={play.state}
        operation={play.operation}
        isStuck={play.isStuck}
        undoCount={play.undoCount}
        canUndo={play.canUndo}
        canRestart={play.canRestart}
        onExitCar={play.exitCar}
        onUndo={play.undo}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <ShuttleParkingDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
