import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createNanpureDiagnosticSnapshot } from "@/games/nanpure/diagnostics";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import type { NanpureResult } from "@/games/nanpure/play/use-nanpure-play";
import type { NanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { NanpureDiagnostics } from "@/games/nanpure/ui/NanpureDiagnostics";
import { NanpureResultScreen } from "@/games/nanpure/ui/result/NanpureResultScreen";

type RecordedNanpureResultProps = RecordedGameResultProps<
  NanpureDifficulty,
  NanpureProblemIdentity,
  NanpureResult
>;

/** 記録から作り直したナンプレの結果画面。 */
export function RecordedNanpureResult(props: RecordedNanpureResultProps) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createNanpureDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <NanpureResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <NanpureDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
