import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type {
  HakoiriMusumeDiagnosticAnalysis,
  HakoiriMusumeDiagnosticSnapshot,
} from "@/games/hakoiri-musume/diagnostics";
import type { HakoiriMusumeDifficultyAssessment } from "@/games/hakoiri-musume/difficulty";
import { HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT } from "@/games/hakoiri-musume/problem/daughter-detour";
import {
  type HakoiriMusumePieceKind,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";

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

function formatDetourCount(count: number): string {
  return count > HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT
    ? `${HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT + 1}回以上`
    : `${count}回`;
}

/** 問題の駒の組。娘はどの問題にも1つなので、ほかの駒の数を、図鑑の詳しい表示と同じ書き方で並べる。 */
function describePieceSet(board: string): string {
  const pieces = parseHakoiriMusumeBoard(board) ?? [];
  const countOf = (kind: HakoiriMusumePieceKind) =>
    pieces.filter((piece) => piece.kind === kind).length;
  return `横長 ${countOf("horizontal")}個 縦長 ${countOf("vertical")}個 小駒 ${countOf("small")}個`;
}

function listAnalysisItems(analysis: HakoiriMusumeDiagnosticAnalysis) {
  if (analysis.status === "invalid") {
    return [];
  }
  if (analysis.status === "pooled") {
    const { features } = analysis;
    return [
      { label: "値の出どころ", value: "問題集（作るときに分析した値）" },
      { label: "準備の長さ", value: `${features.preparationLength}手` },
      ...(features.shortestPreparationLength === undefined
        ? []
        : [
            {
              label: "最短の解の準備",
              value: `${features.shortestPreparationLength}手`,
            },
          ]),
      ...(features.daughterDetourCount === undefined
        ? []
        : [
            {
              label: "娘の遠回り",
              value: formatDetourCount(features.daughterDetourCount),
            },
          ]),
      { label: "空きマス", value: `${features.emptyCellCount}マス` },
      { label: "最短手数", value: `${features.optimalMoveCount}手` },
    ];
  }
  if (analysis.status === "recorded") {
    const { features } = analysis;
    return [
      {
        label: "値の出どころ",
        value: "記録（問題集に無い問題。記録したときの値）",
      },
      { label: "準備の長さ", value: `${features.preparationLength}手` },
      { label: "空きマス", value: `${features.emptyCellCount}マス` },
      { label: "最短手数", value: `${features.optimalMoveCount}手` },
    ];
  }
  const { features } = analysis;
  return [
    { label: "準備の長さ", value: `${features.preparationLength}手` },
    {
      label: "最短の解の準備",
      value: `${features.shortestPreparationLength}手`,
    },
    {
      label: "娘の遠回り",
      value: formatDetourCount(features.daughterDetourCount),
    },
    { label: "空きマス", value: `${features.emptyCellCount}マス` },
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
      generationConditions={describePieceSet(snapshot.problemIdentity.seed)}
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
