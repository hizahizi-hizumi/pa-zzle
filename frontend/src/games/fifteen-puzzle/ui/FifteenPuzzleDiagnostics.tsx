import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { FifteenPuzzleDiagnosticSnapshot } from "@/games/fifteen-puzzle/diagnostics";
import { getFifteenPuzzleDifficultyLabel } from "@/games/fifteen-puzzle/difficulty";

type FifteenPuzzleDiagnosticsProps = {
  snapshot: FifteenPuzzleDiagnosticSnapshot;
  onClose: () => void;
};

export function FifteenPuzzleDiagnostics({
  snapshot,
  onClose,
}: FifteenPuzzleDiagnosticsProps) {
  const { size, scrambleLength } = snapshot.problemIdentity.conditions;

  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getFifteenPuzzleDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={`盤面 ${size}×${size} / 撹拌 ${scrambleLength}手`}
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
