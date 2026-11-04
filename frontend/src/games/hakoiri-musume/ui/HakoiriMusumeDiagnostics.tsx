import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { HakoiriMusumeDiagnosticSnapshot } from "@/games/hakoiri-musume/diagnostics";

type HakoiriMusumeDiagnosticsProps = {
  snapshot: HakoiriMusumeDiagnosticSnapshot;
  onClose: () => void;
};

export function HakoiriMusumeDiagnostics({
  snapshot,
  onClose,
}: HakoiriMusumeDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions="盤面 4×5"
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
