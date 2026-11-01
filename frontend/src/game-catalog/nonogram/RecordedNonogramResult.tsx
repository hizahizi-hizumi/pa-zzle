import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createNonogramDiagnosticSnapshot } from "@/games/nonogram/diagnostics";
import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import type { NonogramResult } from "@/games/nonogram/play/use-nonogram-play";
import type { NonogramProblemIdentity } from "@/games/nonogram/problem/problem";
import { NonogramDiagnostics } from "@/games/nonogram/ui/NonogramDiagnostics";
import { NonogramResultScreen } from "@/games/nonogram/ui/result/NonogramResultScreen";

type RecordedNonogramResultProps = RecordedGameResultProps<
  NonogramDifficulty,
  NonogramProblemIdentity,
  NonogramResult
>;

/** 記録から作り直したノノグラムの結果画面。 */
export function RecordedNonogramResult(props: RecordedNonogramResultProps) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createNonogramDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <NonogramResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <NonogramDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
