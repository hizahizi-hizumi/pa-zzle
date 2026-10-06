import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createTakuzuDiagnosticSnapshot } from "@/games/takuzu/diagnostics";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type { TakuzuResult } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { TakuzuResultScreen } from "@/games/takuzu/ui/result/TakuzuResultScreen";
import { TakuzuDiagnostics } from "@/games/takuzu/ui/TakuzuDiagnostics";

type RecordedTakuzuResultProps = RecordedGameResultProps<
  TakuzuDifficulty,
  TakuzuProblemIdentity,
  TakuzuResult
>;

/** 記録から作り直したバイナリパズルの結果画面。 */
export function RecordedTakuzuResult(props: RecordedTakuzuResultProps) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createTakuzuDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <TakuzuResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <TakuzuDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
