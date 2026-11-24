import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { FukumenzanDiagnosticSnapshot } from "@/games/fukumenzan/diagnostics";

type FukumenzanDiagnosticsProps = {
  snapshot: FukumenzanDiagnosticSnapshot;
  onClose: () => void;
};

export function FukumenzanDiagnostics({
  snapshot,
  onClose,
}: FukumenzanDiagnosticsProps) {
  const { generatorVersion, seed, conditions } = snapshot.problemIdentity;
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={seed}
      generatorVersion={generatorVersion}
      generationConditions={conditions.addendLengths.join("+")}
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
