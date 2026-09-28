import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { NanpureDiagnosticSnapshot } from "@/games/nanpure/diagnostics";
import { getNanpureDifficultyLabel } from "@/games/nanpure/difficulty";
import type { NanpureGenerationConditions } from "@/games/nanpure/problem/problem";

type NanpureDiagnosticsProps = {
  snapshot: NanpureDiagnosticSnapshot;
  onClose: () => void;
};

// 上限なしは、一意解であることだけを保ってヒントを減らした生成。
function formatGenerationConditions({
  removalTechniqueLimit,
}: NanpureGenerationConditions): string {
  return `上限 ${removalTechniqueLimit ?? "一意解のみ"}`;
}

export function NanpureDiagnostics({
  snapshot,
  onClose,
}: NanpureDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getNanpureDifficultyLabel(snapshot.difficulty)}
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
