import {
  type InternalDiagnosticSection,
  InternalDiagnosticsDialog,
} from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { ReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import { getReflectionDifficultyLabel } from "@/games/reflection/difficulty";
import type { ReflectionGenerationConditions } from "@/games/reflection/problem/problem";
import type { ReflectionProblemPoolReference } from "@/games/reflection/problem/problem-pool";

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

function formatProblemPool({
  poolVersion,
  problemId,
}: ReflectionProblemPoolReference): string {
  return `v${poolVersion} / ${problemId}`;
}

function listDetails({
  problemPool,
  difficultyAssessment,
}: ReflectionDiagnosticSnapshot): InternalDiagnosticSection["items"] {
  return [
    { label: "問題集", value: formatProblemPool(problemPool), mono: true },
    {
      label: "分類",
      value: getReflectionDifficultyLabel(difficultyAssessment.difficulty),
    },
    {
      label: "最高推論",
      value: `L${difficultyAssessment.reasoningLevel}`,
      mono: true,
    },
  ];
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
      sections={[{ title: "問題集と分類", items: listDetails(snapshot) }]}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
