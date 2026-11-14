import {
  type RecordedGameResultProps,
  useRecordedGameResult,
} from "@/app/game-integration/recorded-game-result";
import { createMinesweeperDiagnosticSnapshot } from "@/games/minesweeper/diagnostics";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import type { MinesweeperResult } from "@/games/minesweeper/play/use-minesweeper-play";
import type { MinesweeperProblemIdentity } from "@/games/minesweeper/problem/problem";
import { MinesweeperDiagnostics } from "@/games/minesweeper/ui/MinesweeperDiagnostics";
import { MinesweeperResultScreen } from "@/games/minesweeper/ui/result/MinesweeperResultScreen";

type RecordedMinesweeperResultProps = RecordedGameResultProps<
  MinesweeperDifficulty,
  MinesweeperProblemIdentity,
  MinesweeperResult
>;

export function RecordedMinesweeperResult(
  props: RecordedMinesweeperResultProps,
) {
  const { screenProps, diagnostics } = useRecordedGameResult(
    props,
    function createDiagnosticSnapshot(buildRevision) {
      return createMinesweeperDiagnosticSnapshot({
        difficulty: props.difficulty,
        problemIdentity: props.problemIdentity,
        buildRevision,
      });
    },
  );

  return (
    <>
      <MinesweeperResultScreen {...screenProps} />
      {diagnostics.snapshot && (
        <MinesweeperDiagnostics
          snapshot={diagnostics.snapshot}
          onClose={diagnostics.close}
        />
      )}
    </>
  );
}
