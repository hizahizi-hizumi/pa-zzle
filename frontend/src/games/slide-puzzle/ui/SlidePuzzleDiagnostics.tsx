import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { SlidePuzzleDiagnosticSnapshot } from "@/games/slide-puzzle/diagnostics";

type SlidePuzzleDiagnosticsProps = {
  snapshot: SlidePuzzleDiagnosticSnapshot;
  onClose: () => void;
};

export function SlidePuzzleDiagnostics({
  snapshot,
  onClose,
}: SlidePuzzleDiagnosticsProps) {
  const { size, scrambleLength } = snapshot.problemIdentity.conditions;

  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={`盤面 ${size}×${size} / 撹拌 ${scrambleLength}手`}
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
