import { nonogramCatalogEntry } from "@/game-catalog/nonogram/nonogram-catalog-entry";
import {
  type CompletedGamePlay,
  usePlayableGame,
} from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { createNonogramDiagnosticSnapshot } from "@/games/nonogram/diagnostics";
import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import {
  type NonogramResult,
  useNonogramPlay,
} from "@/games/nonogram/play/use-nonogram-play";
import { createNonogramPlayAttemptProgress } from "@/games/nonogram/play-attempt";
import {
  createNonogramPlayRecord,
  nonogramPlayRecordDefinition,
} from "@/games/nonogram/play-record";
import type { NonogramProblemIdentity } from "@/games/nonogram/problem/problem";
import { selectNonogramProblemById } from "@/games/nonogram/problem-selection";
import { NonogramDiagnostics } from "@/games/nonogram/ui/NonogramDiagnostics";
import { NonogramPlay } from "@/games/nonogram/ui/NonogramPlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableNonogramProps = {
  difficulty: NonogramDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

function createPlayRecord(
  completed: CompletedGamePlay<
    NonogramDifficulty,
    NonogramProblemIdentity,
    NonogramResult
  >,
) {
  return createNonogramPlayRecord({
    ...completed,
    workload: completed.result.workload,
  });
}

export function PlayableNonogram({
  difficulty,
  avoidedProblemId,
}: PlayableNonogramProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectNonogramProblemById(difficulty, problemId),
  );
  const play = useNonogramPlay(difficulty, requestedProblem, avoidedProblemId);
  const { screenProps, diagnostics } = usePlayableGame({
    game: nonogramCatalogEntry,
    play,
    playRecordDefinition: nonogramPlayRecordDefinition,
    createPlayRecord,
    createPlayAttemptProgress: createNonogramPlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createNonogramDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <NonogramPlay
        {...screenProps}
        board={play.board}
        clues={play.clues}
        matchedLines={play.matchedLines}
        strokeRange={play.strokeRange}
        repaintCount={play.repaintCount}
        canUndo={play.canUndo}
        canRestart={play.canRestart}
        onStartStroke={play.startStroke}
        onExtendStroke={play.extendStroke}
        onEndStroke={play.endStroke}
        onUndo={play.undo}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <NonogramDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
