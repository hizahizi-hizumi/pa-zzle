import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createWaterSortDiagnosticSnapshot } from "@/games/water-sort/diagnostics";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import type { WaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortProblemIdentity } from "@/games/water-sort/problem/problem";
import { WaterSortResultScreen } from "@/games/water-sort/ui/result/WaterSortResultScreen";
import { WaterSortDiagnostics } from "@/games/water-sort/ui/WaterSortDiagnostics";

type RecordedWaterSortResultProps = RecordedGameResultProps<
  WaterSortDifficulty,
  WaterSortProblemIdentity,
  WaterSortResult
>;

/** 記録から作り直したウォーターソートの結果画面。 */
export function RecordedWaterSortResult(props: RecordedWaterSortResultProps) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createWaterSortDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <WaterSortResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <WaterSortDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
