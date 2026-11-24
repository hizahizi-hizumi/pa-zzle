import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/app/game-integration/recorded-game-result";
import { createFukumenzanDiagnosticSnapshot } from "@/games/fukumenzan/diagnostics";
import type { FukumenzanDifficulty } from "@/games/fukumenzan/difficulty";
import type { FukumenzanResult } from "@/games/fukumenzan/play/use-fukumenzan-play";
import type { FukumenzanProblemIdentity } from "@/games/fukumenzan/problem/problem";
import { FukumenzanDiagnostics } from "@/games/fukumenzan/ui/FukumenzanDiagnostics";
import { FukumenzanResultScreen } from "@/games/fukumenzan/ui/result/FukumenzanResultScreen";

type RecordedFukumenzanResultProps = RecordedGameResultProps<
  FukumenzanDifficulty,
  FukumenzanProblemIdentity,
  FukumenzanResult
>;

export function RecordedFukumenzanResult(props: RecordedFukumenzanResultProps) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createFukumenzanDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <FukumenzanResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <FukumenzanDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
