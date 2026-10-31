import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { MinesweeperDiagnosticSnapshot } from "@/games/minesweeper/diagnostics";

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
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
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
