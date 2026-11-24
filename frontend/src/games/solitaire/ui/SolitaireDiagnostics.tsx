import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { SolitaireDiagnosticSnapshot } from "@/games/solitaire/diagnostics";

type SolitaireDiagnosticsProps = {
  snapshot: SolitaireDiagnosticSnapshot;
  onClose: () => void;
};

/** どの問題も同じ規模で生成条件を持たないので、条件の欄は「なし」にする。配った札は seed から読める。 */
export function SolitaireDiagnostics({
  snapshot,
  onClose,
}: SolitaireDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions="なし"
      buildRevision={snapshot.buildRevision}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
