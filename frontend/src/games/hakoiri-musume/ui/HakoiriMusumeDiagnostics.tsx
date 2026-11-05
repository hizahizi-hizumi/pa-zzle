import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { HakoiriMusumeDiagnosticSnapshot } from "@/games/hakoiri-musume/diagnostics";
import type { HakoiriMusumeDifficultyAssessment } from "@/games/hakoiri-musume/difficulty";
import type { HakoiriMusumeDifficultyAnalysis } from "@/games/hakoiri-musume/problem/difficulty-analysis";

type HakoiriMusumeDiagnosticsProps = {
  snapshot: HakoiriMusumeDiagnosticSnapshot;
  onClose: () => void;
};

const outOfRangeLabels = {
  "too-light": "最短手数が短すぎる",
  "too-long": "最短手数が長すぎる",
  "unlisted-combination": "どのレベルの組み合わせにも当たらない",
} as const;

function formatAssessment(
  assessment: HakoiriMusumeDifficultyAssessment,
): string {
  switch (assessment.status) {
    case "classified":
      return getDifficultyLabel(assessment.difficulty);
    case "out-of-range":
      return `提供範囲外（${outOfRangeLabels[assessment.reason]}）`;
    case "invalid":
      return "成立しない（娘が出口に着けない）";
  }
}

function listAnalysisItems(analysis: HakoiriMusumeDifficultyAnalysis) {
  if (analysis.status === "invalid") {
    return [];
  }
  const { features } = analysis;
  return [
    { label: "準備の長さ", value: `${features.preparationLength}手` },
    { label: "娘の遠回り", value: `${features.daughterDetourCount}回` },
    { label: "空き", value: `${features.emptyCellCount}マス` },
    { label: "最短手数", value: `${features.optimalMoveCount}手` },
    { label: "誘いの局面", value: `${features.lureCount}` },
    { label: "娘の手", value: `${features.daughterMoveCount}手` },
    {
      label: "初手",
      value: `${features.firstMoveCount}通り（最短 ${features.optimalFirstMoveCount}）`,
    },
  ];
}

export function HakoiriMusumeDiagnostics({
  snapshot,
  onClose,
}: HakoiriMusumeDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions="盤面 4×5"
      buildRevision={snapshot.buildRevision}
      sections={[
        {
          title: "難易度判定",
          items: [
            {
              label: "分類",
              value: formatAssessment(snapshot.difficultyAssessment),
            },
            ...listAnalysisItems(snapshot.difficultyAnalysis),
          ],
        },
      ]}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
