import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/app/game-integration/recorded-game-result";
import { createSolitaireDiagnosticSnapshot } from "@/games/solitaire/diagnostics";
import type { SolitaireDifficulty } from "@/games/solitaire/difficulty";
import type { SolitaireResult } from "@/games/solitaire/play/use-solitaire-play";
import type { SolitaireProblemIdentity } from "@/games/solitaire/problem/problem";
import { SolitaireResultScreen } from "@/games/solitaire/ui/result/SolitaireResultScreen";
import { SolitaireDiagnostics } from "@/games/solitaire/ui/SolitaireDiagnostics";

type RecordedSolitaireResultProps = RecordedGameResultProps<
  SolitaireDifficulty,
  SolitaireProblemIdentity,
  SolitaireResult
>;

export function RecordedSolitaireResult(props: RecordedSolitaireResultProps) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createSolitaireDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <SolitaireResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <SolitaireDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
