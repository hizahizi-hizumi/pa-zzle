import { InternalDiagnosticsDialog } from "@/components/InternalDiagnosticsDialog";
import { getDifficultyLabel } from "@/games/difficulty";
import {
  type ParkingJamDiagnosticSnapshot,
  serializeParkingJamDiagnosticSnapshot,
} from "@/games/parking-jam/diagnostics";
import type { ParkingJamDifficultyAssessment } from "@/games/parking-jam/difficulty";

type ParkingJamDiagnosticsProps = {
  snapshot: ParkingJamDiagnosticSnapshot;
  onClose: () => void;
};

function formatRatio(value: number | null): string {
  return value === null ? "取得なし" : `${(value * 100).toFixed(1)}%`;
}

function formatDecimal(value: number | null): string {
  return value === null ? "取得なし" : value.toFixed(3);
}

function formatInteger(value: number | null): string {
  return value === null ? "取得なし" : String(value);
}

const outOfRangeReasonLabels = {
  "too-light": "提供範囲外（軽すぎ）",
  "too-heavy": "提供範囲外（重すぎ）",
  "unlisted-combination": "提供範囲外（組合せ外）",
} as const;

function formatAssessment(assessment: ParkingJamDifficultyAssessment): string {
  switch (assessment.status) {
    case "classified":
      return getDifficultyLabel(assessment.difficulty);
    case "out-of-range":
      return outOfRangeReasonLabels[assessment.reason];
    case "unsupported":
      return "評価不能";
  }
}

function formatLevers(assessment: ParkingJamDifficultyAssessment): string {
  if (!("levers" in assessment)) return "取得なし";
  const { dependency, misread, scale } = assessment.levers;
  return `依存 ${dependency} / 読み違い ${misread} / 規模 ${scale}`;
}

export function ParkingJamDiagnostics({
  snapshot,
  onClose,
}: ParkingJamDiagnosticsProps) {
  const { conditions } = snapshot.problemIdentity;
  const { features } = snapshot.difficultyAnalysis;

  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={`${conditions.width}×${conditions.height} / 車 ${conditions.vehicleCount} / 開口 ${conditions.roadOpeningCount}×${conditions.roadOpeningSpan} / 固定物 ${conditions.fixedAreaCount}×${conditions.fixedAreaLength} / 遮断 ${conditions.blockingPlacementProbability}`}
      generationAttempt={snapshot.problemIdentity.generationAttempt}
      buildRevision={snapshot.buildRevision}
      sections={[
        {
          title: "難易度判定",
          items: [
            {
              label: "判定モデル",
              value: snapshot.difficultyModelVersion,
              mono: true,
            },
            {
              label: "判定",
              value: formatAssessment(snapshot.difficultyAssessment),
            },
            {
              label: "レバー",
              value: formatLevers(snapshot.difficultyAssessment),
              mono: true,
            },
          ],
        },
        {
          title: "構造",
          items: [
            {
              label: "依存深さ",
              value: String(features.dependencyDepth),
              mono: true,
            },
            {
              label: "最少先行台数の最大",
              value: formatInteger(features.maximumPrerequisiteVehicleCount),
              mono: true,
            },
            {
              label: "初期合法車",
              value: `${features.initialLegalVehicleCount} / ${formatRatio(features.initialLegalVehicleRatio)}`,
              mono: true,
            },
            {
              label: "平均合法車率",
              value: formatRatio(features.averageLegalVehicleRatio),
              mono: true,
            },
            {
              label: "最小合法車率",
              value: formatRatio(features.minimumLegalVehicleRatio),
              mono: true,
            },
            {
              label: "強制選択状態率",
              value: formatRatio(features.forcedChoiceStateRatio),
              mono: true,
            },
            {
              label: "新規解放",
              value: `平均 ${formatDecimal(features.averageNewlyUnlockedVehicleCount)} / 最大 ${formatInteger(features.maximumNewlyUnlockedVehicleCount)}`,
              mono: true,
            },
            {
              label: "必須先行関係",
              value: formatInteger(features.requiredPrecedenceCount),
              mono: true,
            },
            {
              label: "最大必須先行",
              value: formatInteger(features.maximumRequiredPredecessorCount),
              mono: true,
            },
            {
              label: "車両遮断辺",
              value: String(features.vehicleBlockingEdgeCount),
              mono: true,
            },
            {
              label: "最大遮断次数",
              value: `先 ${features.maximumVehicleBlockingOutDegree} / 被 ${features.maximumVehicleBlockingInDegree}`,
              mono: true,
            },
            {
              label: "解順",
              value: features.legalOrderCount ?? "取得なし",
              mono: true,
              breakAll: true,
            },
            {
              label: "解順自由度",
              value: formatDecimal(features.solutionOrderFreedom),
              mono: true,
            },
            {
              label: "到達状態数",
              value: formatInteger(features.reachableStateCount),
              mono: true,
            },
          ],
        },
        {
          title: "方向・視覚探索",
          items: [
            {
              label: "車両数",
              value: String(features.vehicleCount),
              mono: true,
            },
            {
              label: "読み違いを誘う車",
              value: `${features.misreadInducingVehicleCount}（ずれ開口 ${features.adjacentLaneOpeningVehicleCount} / 方向判断 ${features.directionChoiceVehicleCount} / 遠い遮断 ${features.farBlockedVehicleCount}）`,
              mono: true,
            },
            {
              label: "退出方向",
              value: String(features.availableExitDirectionCount),
              mono: true,
            },
            {
              label: "初期遮断方向",
              value: `${features.initialBlockedExitDirectionCount} / ${formatRatio(features.initialBlockedExitDirectionRatio)}`,
              mono: true,
            },
            {
              label: "平均合法方向",
              value: formatDecimal(features.averageLegalDirectionCount),
              mono: true,
            },
            {
              label: "車セル占有率",
              value: formatRatio(features.vehicleCellOccupancyRatio),
              mono: true,
            },
            {
              label: "長車率",
              value: formatRatio(features.longVehicleRatio),
              mono: true,
            },
            {
              label: "道路開口率",
              value: formatRatio(features.roadOpeningCoverageRatio),
              mono: true,
            },
            {
              label: "退出距離",
              value: `平均 ${features.averageExitPathLength.toFixed(2)} / 最大 ${features.maximumExitPathLength}`,
              mono: true,
            },
          ],
        },
      ]}
      serializedSnapshot={serializeParkingJamDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
