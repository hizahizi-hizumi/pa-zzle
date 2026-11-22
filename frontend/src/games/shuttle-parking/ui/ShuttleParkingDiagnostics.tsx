import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { ShuttleParkingDiagnosticSnapshot } from "@/games/shuttle-parking/diagnostics";

type ShuttleParkingDiagnosticsProps = {
  snapshot: ShuttleParkingDiagnosticSnapshot;
  onClose: () => void;
};

export function ShuttleParkingDiagnostics({
  snapshot,
  onClose,
}: ShuttleParkingDiagnosticsProps) {
  const { size } = snapshot.problemIdentity.conditions;

  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={`駐車場 ${size}×${size}`}
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
