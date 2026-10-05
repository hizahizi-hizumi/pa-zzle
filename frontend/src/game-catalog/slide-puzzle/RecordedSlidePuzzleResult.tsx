import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createSlidePuzzleDiagnosticSnapshot } from "@/games/slide-puzzle/diagnostics";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import type { SlidePuzzleResult } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type { SlidePuzzleProblemIdentity } from "@/games/slide-puzzle/problem/problem";
import { SlidePuzzleResultScreen } from "@/games/slide-puzzle/ui/result/SlidePuzzleResultScreen";
import { SlidePuzzleDiagnostics } from "@/games/slide-puzzle/ui/SlidePuzzleDiagnostics";

type RecordedSlidePuzzleResultProps = RecordedGameResultProps<
  SlidePuzzleDifficulty,
  SlidePuzzleProblemIdentity,
  SlidePuzzleResult
>;

/** 記録から作り直したスライドパズルの結果画面。 */
export function RecordedSlidePuzzleResult(
  props: RecordedSlidePuzzleResultProps,
) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createSlidePuzzleDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <SlidePuzzleResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <SlidePuzzleDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
