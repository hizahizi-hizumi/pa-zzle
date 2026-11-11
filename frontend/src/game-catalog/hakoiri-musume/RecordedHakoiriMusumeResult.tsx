import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createHakoiriMusumeDiagnosticSnapshot } from "@/games/hakoiri-musume/diagnostics";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import type { HakoiriMusumeResult } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import type { HakoiriMusumeProblemIdentity } from "@/games/hakoiri-musume/problem/problem";
import { HakoiriMusumeDiagnostics } from "@/games/hakoiri-musume/ui/HakoiriMusumeDiagnostics";
import { HakoiriMusumeResultScreen } from "@/games/hakoiri-musume/ui/result/HakoiriMusumeResultScreen";

type RecordedHakoiriMusumeResultProps = RecordedGameResultProps<
  HakoiriMusumeDifficulty,
  HakoiriMusumeProblemIdentity,
  HakoiriMusumeResult
>;

/** 記録から作り直した箱入り娘の結果画面。 */
export function RecordedHakoiriMusumeResult(
  props: RecordedHakoiriMusumeResultProps,
) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createHakoiriMusumeDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
        recordedWorkload: {
          optimalMoveCount: props.result.optimalMoveCount,
          preparationLength: props.result.preparationLength,
        },
      });
    },
  );

  return (
    <>
      <HakoiriMusumeResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <HakoiriMusumeDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
