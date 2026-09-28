import {
  type InternalDiagnosticSection,
  InternalDiagnosticsDialog,
} from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import type { ReflectionDiagnosticSnapshot } from "@/games/reflection/diagnostics";
import {
  getReflectionDifficultyLabel,
  type ReflectionDifficultyAssessment,
} from "@/games/reflection/difficulty";
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

function formatProblemPool(
  problemPool: ReflectionProblemPoolReference | null,
): string {
  return problemPool
    ? `v${problemPool.poolVersion} / ${problemPool.problemId}`
    : "問題集に無い";
}

function formatAssessment(assessment: ReflectionDifficultyAssessment): string {
  switch (assessment.status) {
    case "classified":
      return getReflectionDifficultyLabel(assessment.difficulty);
    case "out-of-range":
      return "提供範囲外（組み合わせ外）";
    case "unsupported":
      return "評価不能";
    case "invalid":
      return "問題として不成立";
  }
}

function formatHighestReasoningLevel(
  assessment: ReflectionDifficultyAssessment,
): string {
  return "reasoningLevel" in assessment
    ? `L${assessment.reasoningLevel}`
    : "取得なし";
}

function listDetails({
  problemPool,
  difficultyAssessment,
}: ReflectionDiagnosticSnapshot): InternalDiagnosticSection["items"] {
  return [
    { label: "問題集", value: formatProblemPool(problemPool), mono: true },
    { label: "分類", value: formatAssessment(difficultyAssessment) },
    {
      label: "最高推論",
      value: formatHighestReasoningLevel(difficultyAssessment),
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
