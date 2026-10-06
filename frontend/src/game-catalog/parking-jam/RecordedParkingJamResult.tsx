import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createParkingJamDiagnosticSnapshot } from "@/games/parking-jam/diagnostics";
import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type { ParkingJamResult } from "@/games/parking-jam/play/use-parking-jam-play";
import type { ParkingJamProblemIdentity } from "@/games/parking-jam/problem/problem";
import { ParkingJamDiagnostics } from "@/games/parking-jam/ui/ParkingJamDiagnostics";
import { ParkingJamResultScreen } from "@/games/parking-jam/ui/result/ParkingJamResultScreen";

type RecordedParkingJamResultProps = RecordedGameResultProps<
  ParkingJamDifficulty,
  ParkingJamProblemIdentity,
  ParkingJamResult
>;

/** 記録から作り直したパーキングジャムの結果画面。 */
export function RecordedParkingJamResult(props: RecordedParkingJamResultProps) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createParkingJamDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <ParkingJamResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <ParkingJamDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
