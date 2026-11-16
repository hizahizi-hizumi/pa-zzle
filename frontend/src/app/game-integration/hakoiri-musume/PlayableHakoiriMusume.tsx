import { hakoiriMusumeCatalogEntry } from "@/app/game-integration/hakoiri-musume/hakoiri-musume-catalog-entry";
import { usePlayableGame } from "@/app/game-integration/playable-game";
import { createHakoiriMusumeDiagnosticSnapshot } from "@/games/hakoiri-musume/diagnostics";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { useHakoiriMusumePlay } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import { createHakoiriMusumePlayAttemptProgress } from "@/games/hakoiri-musume/play-attempt";
import {
  createHakoiriMusumePlayRecord,
  hakoiriMusumePlayRecordDefinition,
} from "@/games/hakoiri-musume/play-record";
import type { HakoiriMusumePooledProblem } from "@/games/hakoiri-musume/problem/problem-pool";
import { selectHakoiriMusumeProblemById } from "@/games/hakoiri-musume/problem-selection";
import { HakoiriMusumeDiagnostics } from "@/games/hakoiri-musume/ui/HakoiriMusumeDiagnostics";
import { HakoiriMusumePlay } from "@/games/hakoiri-musume/ui/HakoiriMusumePlay";
import type { ProblemId } from "@/games/problem-id";

type PlayableHakoiriMusumeProps = {
  difficulty: HakoiriMusumeDifficulty;
  problemId: ProblemId;
  /** 開発時の試遊で、問題集に無い問題を遊ぶときに渡す。 */
  initialProblem?: HakoiriMusumePooledProblem;
};

export function PlayableHakoiriMusume({
  difficulty,
  problemId,
  initialProblem,
}: PlayableHakoiriMusumeProps) {
  const requestedProblem =
    initialProblem ?? selectHakoiriMusumeProblemById(difficulty, problemId);
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useHakoiriMusumePlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
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
        layout={play.layout}
        pieces={play.pieces}
        moveCount={play.moveCount}
        stepNotice={play.stepNotice}
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
