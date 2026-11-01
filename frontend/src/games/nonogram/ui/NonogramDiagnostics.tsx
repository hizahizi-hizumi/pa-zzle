import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { NonogramDiagnosticSnapshot } from "@/games/nonogram/diagnostics";
import type { NonogramGenerationConditions } from "@/games/nonogram/problem/problem";

type NonogramDiagnosticsProps = {
  snapshot: NonogramDiagnosticSnapshot;
  onClose: () => void;
};

function formatGenerationConditions({
  width,
  height,
  blackProbability,
  smoothingCount,
  mirrored,
}: NonogramGenerationConditions): string {
  return `${width}×${height} / 黒 ${blackProbability.toFixed(2)} / 平滑化 ${smoothingCount} / ${mirrored ? "左右対称" : "対称なし"}`;
}

export function NonogramDiagnostics({
  snapshot,
  onClose,
}: NonogramDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
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
