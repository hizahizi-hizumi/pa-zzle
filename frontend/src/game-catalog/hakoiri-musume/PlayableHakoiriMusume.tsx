import { hakoiriMusumeCatalogEntry } from "@/game-catalog/hakoiri-musume/hakoiri-musume-catalog-entry";
import { usePlayableGame } from "@/game-catalog/playable-game";
import { useRequestedProblem } from "@/game-catalog/problem-id-query";
import { createHakoiriMusumeDiagnosticSnapshot } from "@/games/hakoiri-musume/diagnostics";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { useHakoiriMusumePlay } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import { createHakoiriMusumePlayAttemptProgress } from "@/games/hakoiri-musume/play-attempt";
import {
  createHakoiriMusumePlayRecord,
  hakoiriMusumePlayRecordDefinition,
} from "@/games/hakoiri-musume/play-record";
import { selectHakoiriMusumeProblemById } from "@/games/hakoiri-musume/problem-selection";
import { HakoiriMusumeDiagnostics } from "@/games/hakoiri-musume/ui/HakoiriMusumeDiagnostics";
import { HakoiriMusumePlay } from "@/games/hakoiri-musume/ui/HakoiriMusumePlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableHakoiriMusumeProps = {
  difficulty: HakoiriMusumeDifficulty;
  /** 最初の問題として選ばない問題の ID。URL の問題 ID で問題を指定したときは使わない。 */
  avoidedProblemId?: ProblemId;
};

export function PlayableHakoiriMusume({
  difficulty,
  avoidedProblemId,
}: PlayableHakoiriMusumeProps) {
  const requestedProblem = useRequestedProblem((problemId) =>
    selectHakoiriMusumeProblemById(difficulty, problemId),
  );
  const play = useHakoiriMusumePlay(
    difficulty,
    requestedProblem,
    avoidedProblemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: hakoiriMusumeCatalogEntry,
    play,
    playRecordDefinition: hakoiriMusumePlayRecordDefinition,
    createPlayRecord: createHakoiriMusumePlayRecord,
    createPlayAttemptProgress: createHakoiriMusumePlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createHakoiriMusumeDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <HakoiriMusumePlay
        {...screenProps}
        pieces={play.pieces}
        moveCount={play.moveCount}
        onMovePiece={play.movePiece}
        canUndo={play.canUndo}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <HakoiriMusumeDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
