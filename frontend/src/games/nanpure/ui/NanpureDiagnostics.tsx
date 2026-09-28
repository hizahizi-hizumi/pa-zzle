import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { NanpureDiagnosticSnapshot } from "@/games/nanpure/diagnostics";
import { getNanpureLegacyDifficultyLabel } from "@/games/nanpure/legacy/difficulty";

type NanpureDiagnosticsProps = {
  snapshot: NanpureDiagnosticSnapshot;
  onClose: () => void;
};

export function NanpureDiagnostics({
  snapshot,
  onClose,
}: NanpureDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getNanpureLegacyDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={`ヒント ${snapshot.problemIdentity.conditions.clueCount}`}
      generationAttempt={snapshot.problemIdentity.generationAttempt}
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
