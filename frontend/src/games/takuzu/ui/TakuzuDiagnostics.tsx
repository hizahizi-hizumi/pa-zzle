import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { TakuzuDiagnosticSnapshot } from "@/games/takuzu/diagnostics";
import { getTakuzuDifficultyLabel } from "@/games/takuzu/difficulty";
import type { TakuzuGenerationConditions } from "@/games/takuzu/problem/problem";
import { getTakuzuRemovalTechniqueLimitCode } from "@/games/takuzu/problem/problem-pool";

type TakuzuDiagnosticsProps = {
  snapshot: TakuzuDiagnosticSnapshot;
  onClose: () => void;
};

// 生成条件を「盤面 / 手筋の上限 / 戻す数」の順に短く並べる。手筋の上限は難易度文書の A〜E で示し、上限なしは一意解であることだけを保った生成。
function formatGenerationConditions({
  size,
  removalTechniqueLimit,
  extraGivenCount,
}: TakuzuGenerationConditions): string {
  const techniqueLimit =
    removalTechniqueLimit === null
      ? "一意解のみ"
      : getTakuzuRemovalTechniqueLimitCode(removalTechniqueLimit);
  return `${size}×${size} / 上限 ${techniqueLimit} / 戻す ${extraGivenCount}`;
}

export function TakuzuDiagnostics({
  snapshot,
  onClose,
}: TakuzuDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getTakuzuDifficultyLabel(snapshot.difficulty)}
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
