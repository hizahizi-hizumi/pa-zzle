import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { ReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import { getReflectionDifficultyLabel } from "@/games/reflection/difficulty";
import type { ReflectionGenerationConditions } from "@/games/reflection/problem/problem";

type ReflectionDiagnosticsProps = {
  snapshot: ReflectionDiagnosticSnapshot;
  onClose: () => void;
};

function formatGenerationConditions({
  size,
  pieceCount,
}: ReflectionGenerationConditions): string {
  return `${size}×${size} / ${pieceCount}ピース`;
}

export function ReflectionDiagnostics({
  snapshot,
  onClose,
}: ReflectionDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getReflectionDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={formatGenerationConditions(
        snapshot.problemIdentity.conditions,
      )}
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
