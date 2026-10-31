import {
  type InternalDiagnosticSection,
  InternalDiagnosticsDialog,
} from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { IceFloorMazeDiagnosticSnapshot } from "@/games/ice-floor-maze/diagnostics";
import type { IceFloorMazeDifficultyAssessment } from "@/games/ice-floor-maze/difficulty";
import type {
  IceFloorMazeDifficultyAnalysis,
  IceFloorMazeDifficultyFeatures,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import type { IceFloorMazeBoardShape } from "@/games/ice-floor-maze/problem/problem";

type IceFloorMazeDiagnosticsProps = {
  snapshot: IceFloorMazeDiagnosticSnapshot;
  onClose: () => void;
};

const outOfRangeReasonLabels = {
  "too-light": "提供範囲外（短すぎ）",
  "too-long": "提供範囲外（長すぎ）",
  "unlisted-combination": "提供範囲外（組合せ外）",
} as const;

type IceFloorMazePlanningStrategy = Extract<
  IceFloorMazeDifficultyAnalysis,
  { status: "analyzed" }
>["strategies"][number];

const planningStrategyLabels = {
  approach: "近づく",
  align: "揃える",
} as const satisfies Record<IceFloorMazePlanningStrategy, string>;

function formatBoardShape({ width, height }: IceFloorMazeBoardShape): string {
  return `${width}×${height}`;
}

function formatAssessment(
  assessment: IceFloorMazeDifficultyAssessment,
): string {
  switch (assessment.status) {
    case "classified":
      return getDifficultyLabel(assessment.difficulty);
    case "out-of-range":
      return outOfRangeReasonLabels[assessment.reason];
    case "unsupported":
      return "評価不能（読み手数の上限超え）";
    case "invalid":
      return "不成立（ゴールへ止まれない）";
  }
}

function formatPlanningDepth(depth: number | null): string {
  return depth === null ? "解けない" : String(depth);
}

function listPlanningItems(
  analysis: IceFloorMazeDifficultyAnalysis,
): InternalDiagnosticSection["items"] {
  if (analysis.status === "invalid") {
    return [];
  }
  const { features } = analysis;
  return [
    ...(analysis.status === "analyzed"
      ? [
          {
            label: "計画深さ",
            value: `${analysis.planningDepth}（${analysis.strategies.map((strategy) => planningStrategyLabels[strategy]).join("・")}）`,
          },
        ]
      : []),
    {
      label: "方針別",
      value: `近づく ${formatPlanningDepth(features.approachPlanningDepth)} / 揃える ${formatPlanningDepth(features.alignPlanningDepth)}`,
      mono: true,
    },
    {
      label: "試行手数",
      value: String(features.trialMoveCount),
      mono: true,
    },
  ];
}

function listBoardItems(
  features: IceFloorMazeDifficultyFeatures,
): InternalDiagnosticSection["items"] {
  return [
    {
      label: "最少手数",
      value: `${features.optimalMoveCount}（道筋 ${features.optimalSolutionCount}）`,
      mono: true,
    },
    {
      label: "到達停止点",
      value: String(features.reachableStopCount),
      mono: true,
    },
    {
      label: "詰みの停止点",
      value: String(features.deadStopCount),
      mono: true,
    },
    {
      label: "ゴール通過",
      value: String(features.goalPassingStopCount),
      mono: true,
    },
    {
      label: "遠回り",
      value: String(features.detourMoveCount),
      mono: true,
    },
  ];
}

export function IceFloorMazeDiagnostics({
  snapshot,
  onClose,
}: IceFloorMazeDiagnosticsProps) {
  const { difficultyAssessment, difficultyAnalysis } = snapshot;

  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={formatBoardShape(
        snapshot.problemIdentity.conditions,
      )}
      buildRevision={snapshot.buildRevision}
      sections={[
        {
          title: "難易度判定",
          items: [
            { label: "分類", value: formatAssessment(difficultyAssessment) },
            ...listPlanningItems(difficultyAnalysis),
          ],
        },
        ...(difficultyAnalysis.status === "invalid"
          ? []
          : [
              {
                title: "盤面の構造",
                items: listBoardItems(difficultyAnalysis.features),
              },
            ]),
      ]}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
