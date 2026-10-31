import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/game-catalog/recorded-game-result";
import { createIceFloorMazeDiagnosticSnapshot } from "@/games/ice-floor-maze/diagnostics";
import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import type { IceFloorMazeResult } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazeProblemIdentity } from "@/games/ice-floor-maze/problem/problem";
import { IceFloorMazeDiagnostics } from "@/games/ice-floor-maze/ui/IceFloorMazeDiagnostics";
import { IceFloorMazeResultScreen } from "@/games/ice-floor-maze/ui/result/IceFloorMazeResultScreen";

type RecordedIceFloorMazeResultProps = RecordedGameResultProps<
  IceFloorMazeDifficulty,
  IceFloorMazeProblemIdentity,
  IceFloorMazeResult
>;

/** 記録から作り直した氷の床迷路の結果画面。 */
export function RecordedIceFloorMazeResult(
  props: RecordedIceFloorMazeResultProps,
) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createIceFloorMazeDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <IceFloorMazeResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <IceFloorMazeDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
