import { usePlayableGame } from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { slidePuzzleCatalogEntry } from "@/game-catalog/slide-puzzle/slide-puzzle-catalog-entry";
import type { ProblemId } from "@/games/problem-id";
import { createSlidePuzzleDiagnosticSnapshot } from "@/games/slide-puzzle/diagnostics";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { useSlidePuzzlePlay } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { createSlidePuzzlePlayAttemptProgress } from "@/games/slide-puzzle/play-attempt";
import {
  createSlidePuzzlePlayRecord,
  slidePuzzlePlayRecordDefinition,
} from "@/games/slide-puzzle/play-record";
import { selectSlidePuzzleProblemById } from "@/games/slide-puzzle/problem-selection";
import { SlidePuzzleDiagnostics } from "@/games/slide-puzzle/ui/SlidePuzzleDiagnostics";
import { SlidePuzzlePlay } from "@/games/slide-puzzle/ui/SlidePuzzlePlay";

type PlayableSlidePuzzleProps = {
  difficulty: SlidePuzzleDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableSlidePuzzle({
  difficulty,
  avoidedProblemId,
}: PlayableSlidePuzzleProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectSlidePuzzleProblemById(difficulty, problemId),
  );
  const play = useSlidePuzzlePlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: slidePuzzleCatalogEntry,
    play,
    playRecordDefinition: slidePuzzlePlayRecordDefinition,
    createPlayRecord: createSlidePuzzlePlayRecord,
    createPlayAttemptProgress: createSlidePuzzlePlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createSlidePuzzleDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <SlidePuzzlePlay
        {...screenProps}
        board={play.board}
        moveCount={play.moveCount}
        operation={play.operation}
        onSlideTile={play.slideTile}
        onSlideInDirection={play.slideInDirection}
        canRestart={play.canRestart}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <SlidePuzzleDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
