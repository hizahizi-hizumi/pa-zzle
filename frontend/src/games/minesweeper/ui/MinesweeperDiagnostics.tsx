import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { MinesweeperDiagnosticSnapshot } from "@/games/minesweeper/diagnostics";
import { getMinesweeperDifficultyLabel } from "@/games/minesweeper/difficulty";

type MinesweeperDiagnosticsProps = {
  snapshot: MinesweeperDiagnosticSnapshot;
  onClose: () => void;
};

export function MinesweeperDiagnostics({
  snapshot,
  onClose,
}: MinesweeperDiagnosticsProps) {
  const { rows, columns, mineCount, startCellPlacement } =
    snapshot.problemIdentity.conditions;

  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getMinesweeperDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={`${rows}行×${columns}列 / 地雷 ${mineCount} / 開始 ${startCellPlacement}`}
      generationAttempt={snapshot.problemIdentity.generationAttempt}
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
