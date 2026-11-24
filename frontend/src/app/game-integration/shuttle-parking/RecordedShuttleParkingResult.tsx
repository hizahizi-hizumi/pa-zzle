import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/app/game-integration/recorded-game-result";
import { createShuttleParkingDiagnosticSnapshot } from "@/games/shuttle-parking/diagnostics";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import type { ShuttleParkingResult } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import type { ShuttleParkingProblemIdentity } from "@/games/shuttle-parking/problem/problem";
import { ShuttleParkingResultScreen } from "@/games/shuttle-parking/ui/result/ShuttleParkingResultScreen";
import { ShuttleParkingDiagnostics } from "@/games/shuttle-parking/ui/ShuttleParkingDiagnostics";

type RecordedShuttleParkingResultProps = RecordedGameResultProps<
  ShuttleParkingDifficulty,
  ShuttleParkingProblemIdentity,
  ShuttleParkingResult
>;

export function RecordedShuttleParkingResult(
  props: RecordedShuttleParkingResultProps,
) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createShuttleParkingDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <ShuttleParkingResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <ShuttleParkingDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
