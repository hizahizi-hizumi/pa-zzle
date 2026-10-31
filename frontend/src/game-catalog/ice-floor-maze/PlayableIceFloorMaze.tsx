import { iceFloorMazeCatalogEntry } from "@/game-catalog/ice-floor-maze/ice-floor-maze-catalog-entry";
import { usePlayableGame } from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { createIceFloorMazeDiagnosticSnapshot } from "@/games/ice-floor-maze/diagnostics";
import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import { useIceFloorMazePlay } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { createIceFloorMazePlayAttemptProgress } from "@/games/ice-floor-maze/play-attempt";
import {
  createIceFloorMazePlayRecord,
  iceFloorMazePlayRecordDefinition,
} from "@/games/ice-floor-maze/play-record";
import { selectIceFloorMazeProblemById } from "@/games/ice-floor-maze/problem-selection";
import { IceFloorMazeDiagnostics } from "@/games/ice-floor-maze/ui/IceFloorMazeDiagnostics";
import { IceFloorMazePlay } from "@/games/ice-floor-maze/ui/IceFloorMazePlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableIceFloorMazeProps = {
  difficulty: IceFloorMazeDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableIceFloorMaze({
  difficulty,
  avoidedProblemId,
}: PlayableIceFloorMazeProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectIceFloorMazeProblemById(difficulty, problemId),
  );
  const play = useIceFloorMazePlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: iceFloorMazeCatalogEntry,
    play,
    playRecordDefinition: iceFloorMazePlayRecordDefinition,
    createPlayRecord: createIceFloorMazePlayRecord,
    createPlayAttemptProgress: createIceFloorMazePlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createIceFloorMazeDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <IceFloorMazePlay
        {...screenProps}
        board={play.board}
        goal={play.goal}
        position={play.position}
        moveCount={play.moveCount}
        isTrapped={play.isTrapped}
        operation={play.operation}
        onSlide={play.slide}
        canUndo={play.canUndo}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <IceFloorMazeDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
