import { usePlayableGame } from "@/app/game-integration/playable-game";
import { solitaireCatalogEntry } from "@/app/game-integration/solitaire/solitaire-catalog-entry";
import type { ProblemId } from "@/games/problem-id";
import { createSolitaireDiagnosticSnapshot } from "@/games/solitaire/diagnostics";
import type { SolitaireDifficulty } from "@/games/solitaire/difficulty";
import { useSolitairePlay } from "@/games/solitaire/play/use-solitaire-play";
import { createSolitairePlayAttemptProgress } from "@/games/solitaire/play-attempt";
import {
  createSolitairePlayRecord,
  solitairePlayRecordDefinition,
} from "@/games/solitaire/play-record";
import { selectSolitaireProblemById } from "@/games/solitaire/problem-selection";
import { SolitaireDiagnostics } from "@/games/solitaire/ui/SolitaireDiagnostics";
import { SolitairePlay } from "@/games/solitaire/ui/SolitairePlay";

type PlayableSolitaireProps = {
  difficulty: SolitaireDifficulty;
  problemId: ProblemId;
};

export function PlayableSolitaire({
  difficulty,
  problemId,
}: PlayableSolitaireProps) {
  const requestedProblem = selectSolitaireProblemById(difficulty, problemId);
  if (requestedProblem === null)
    throw new Error("指定された問題を復元できません");
  const play = useSolitairePlay(
    difficulty,
    requestedProblem,
    undefined,
    problemId,
  );
  const { screenProps, diagnostics } = usePlayableGame({
    game: solitaireCatalogEntry,
    play,
    playRecordDefinition: solitairePlayRecordDefinition,
    createPlayRecord: createSolitairePlayRecord,
    createPlayAttemptProgress: createSolitairePlayAttemptProgress,
    createDiagnosticSnapshot(buildRevision) {
      return createSolitaireDiagnosticSnapshot({
        difficulty,
        problemIdentity: play.problemIdentity,
        buildRevision,
      });
    },
  });

  return (
    <>
      <SolitairePlay
        {...screenProps}
        state={play.state}
        undoCount={play.undoCount}
        selectedSource={play.selectedSource}
        operation={play.operation}
        isStuck={play.isStuck}
        onSelectPile={play.selectPile}
        canUndo={play.canUndo}
        onUndo={play.undo}
        canRestart={play.canRestart}
        onRestart={play.restart}
      />
      {diagnostics.snapshot && (
        <SolitaireDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
