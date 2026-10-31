import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { TakuzuDiagnosticSnapshot } from "@/games/takuzu/diagnostics";
import type { TakuzuGenerationConditions } from "@/games/takuzu/problem/problem";
import { getTakuzuRemovalTechniqueLimitCode } from "@/games/takuzu/problem/problem-pool";

type TakuzuDiagnosticsProps = {
  snapshot: TakuzuDiagnosticSnapshot;
  onClose: () => void;
};

function formatGenerationConditions({
  size,
  removalTechniqueLimit,
  extraGivenCount,
}: TakuzuGenerationConditions): string {
  // 手筋の上限は難易度文書の A〜E で示す。上限なしは、一意解であることだけを保って初期配置を減らした生成。
  const techniqueLimit =
    removalTechniqueLimit === null
      ? "一意解のみ"
      : getTakuzuRemovalTechniqueLimitCode(removalTechniqueLimit);
  return `${size}×${size} / 上限 ${techniqueLimit} / 手がかり追加 ${extraGivenCount}`;
}

export function TakuzuDiagnostics({
  snapshot,
  onClose,
}: TakuzuDiagnosticsProps) {
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
