import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { WaterSortDiagnosticSnapshot } from "@/games/water-sort/diagnostics";
import { getWaterSortDifficultyLabel } from "@/games/water-sort/difficulty";

type WaterSortDiagnosticsProps = {
  snapshot: WaterSortDiagnosticSnapshot;
  onClose: () => void;
};

export function WaterSortDiagnostics({
  snapshot,
  onClose,
}: WaterSortDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getWaterSortDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={`色 ${snapshot.problemIdentity.conditions.colorCount} / 容量 ${snapshot.problemIdentity.conditions.capacity} / 空 ${snapshot.problemIdentity.conditions.emptyBottleCount}`}
      generationAttempt={snapshot.problemIdentity.generationAttempt}
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
