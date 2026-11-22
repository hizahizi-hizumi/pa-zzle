import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/app/game-integration/recorded-game-result";
import { createMagicSquareDiagnosticSnapshot } from "@/games/magic-square/diagnostics";
import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import type { MagicSquareResult } from "@/games/magic-square/play/use-magic-square-play";
import type { MagicSquareProblemIdentity } from "@/games/magic-square/problem/problem";
import { MagicSquareDiagnostics } from "@/games/magic-square/ui/MagicSquareDiagnostics";
import { MagicSquareResultScreen } from "@/games/magic-square/ui/result/MagicSquareResultScreen";

type RecordedMagicSquareResultProps = RecordedGameResultProps<
  MagicSquareDifficulty,
  MagicSquareProblemIdentity,
  MagicSquareResult
>;

export function RecordedMagicSquareResult(
  props: RecordedMagicSquareResultProps,
) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createMagicSquareDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <MagicSquareResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <MagicSquareDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
