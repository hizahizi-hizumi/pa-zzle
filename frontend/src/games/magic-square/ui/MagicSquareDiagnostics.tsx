import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { MagicSquareDiagnosticSnapshot } from "@/games/magic-square/diagnostics";

type MagicSquareDiagnosticsProps = {
  snapshot: MagicSquareDiagnosticSnapshot;
  onClose: () => void;
};

export function MagicSquareDiagnostics({
  snapshot,
  onClose,
}: MagicSquareDiagnosticsProps) {
  const { size } = snapshot.problemIdentity.conditions;

  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={`${size}×${size}`}
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
