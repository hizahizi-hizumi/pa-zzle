import {
  type InternalDiagnosticSection,
  InternalDiagnosticsDialog,
} from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel } from "@/games/difficulty";
import type { IceFloorMazeDiagnosticSnapshot } from "@/games/ice-floor-maze/diagnostics";
import type {
  IceFloorMazeDifficultyAssessment,
  IceFloorMazeUnmetCondition,
} from "@/games/ice-floor-maze/difficulty";
import type {
  IceFloorMazeDifficultyAnalysis,
  IceFloorMazeElementComposition,
  IceFloorMazeElementFeatures,
  IceFloorMazeTacticFeatures,
  IceFloorMazeTacticTag,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import type { IceFloorMazeBoardShape } from "@/games/ice-floor-maze/problem/problem";

type IceFloorMazeDiagnosticsProps = {
  snapshot: IceFloorMazeDiagnosticSnapshot;
  onClose: () => void;
};

type DiagnosticItems = InternalDiagnosticSection["items"];

const unmetConditionLabels = {
  "multiple-solutions": "最短解が複数",
  forced: "一本道",
  unreadable: "読めない",
  "repeated-direction": "同じ向きが続く",
  "brittle-chain": "もろい岩の連鎖",
  "irrelevant-element": "効かない要素",
  "few-decoys": "おとり不足",
  "few-uses": "使う回数不足",
  "static-shortcut": "見た目どおりで解ける",
  "element-mix": "要素の内訳",
} as const satisfies Record<IceFloorMazeUnmetCondition, string>;

const compositionLabels = {
  none: "氷と岩",
  "brittle-rock": "もろい岩",
  "thin-ice": "薄い氷",
  mixed: "もろい岩と薄い氷",
} as const satisfies Record<IceFloorMazeElementComposition, string>;

const tacticTagLabels = {
  stopper: "止め石",
  "wrap-around": "回り込み",
  "pass-lure": "通過の誘い",
  reentry: "入り直し",
  "trap-lure": "詰みの誘い",
  "pass-trap": "通過で詰む",
  "silent-trap": "知らせのない詰み",
  detour: "遠回り",
  "double-detour": "遠回り2回",
  "backward-funnel": "逆算3段",
  fork: "分かれ道",
} as const satisfies Record<IceFloorMazeTacticTag, string>;

const looksReadingLabels = {
  unsolvable: "解なし",
  misleading: "解が通らない",
  detour: "遠回り",
  shortcut: "近道",
} as const satisfies Record<
  IceFloorMazeElementFeatures["looksReading"],
  string
>;

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
      return assessment.reason === "unmet-conditions"
        ? `提供範囲外（${assessment.unmetConditions.map((condition) => unmetConditionLabels[condition]).join("・")}）`
        : "提供範囲外（組合せ外）";
    case "unsupported":
      return "評価不能（状態の数の上限超え）";
    case "invalid":
      return "不成立（ゴールへ止まれない）";
  }
}

function formatReadingDepth(depth: number | null): string {
  return depth === null ? "読めない" : String(depth);
}

function listTacticItems(
  features: IceFloorMazeTacticFeatures,
): DiagnosticItems {
  return [
    {
      label: "手筋",
      value:
        features.tags.map((tag) => tacticTagLabels[tag]).join("・") || "なし",
    },
    {
      label: "読み深さ",
      value: formatReadingDepth(features.readingDepth),
      mono: true,
    },
    { label: "近い別解", value: String(features.nearPathCount), mono: true },
  ];
}

function listElementItems(
  features: IceFloorMazeElementFeatures,
): DiagnosticItems {
  return [
    {
      label: "難しさの点",
      value: String(Number(features.hardness.toFixed(1))),
      mono: true,
    },
    {
      label: "要素",
      value: `${features.elementCount}（もろい岩 ${features.brittleRockCount} / 薄い氷 ${features.thinIceCount}）`,
      mono: true,
    },
    {
      label: "役割",
      value: `使う ${features.usedElementCount} / おとり ${features.decoyCount} / 弱いおとり ${features.weakDecoyCount}`,
      mono: true,
    },
    {
      label: "見た目どおり",
      value: looksReadingLabels[features.looksReading],
    },
    {
      label: "読み深さ",
      value: formatReadingDepth(features.stateReadingDepth),
      mono: true,
    },
    {
      label: "順序の依存",
      value: `組 ${features.orderDependencyCount} / 連なり ${features.orderChain} / 罠 ${features.orderTrapCount}`,
      mono: true,
    },
  ];
}

function listAnalysisItems(
  analysis: IceFloorMazeDifficultyAnalysis,
): DiagnosticItems {
  if (analysis.status !== "analyzed") {
    return [];
  }
  return [
    { label: "要素の種類", value: compositionLabels[analysis.composition] },
    ...(analysis.composition === "none"
      ? listTacticItems(analysis.features)
      : listElementItems(analysis.features)),
  ];
}

function listBoardItems(
  analysis: Extract<IceFloorMazeDifficultyAnalysis, { status: "analyzed" }>,
): DiagnosticItems {
  const { features } = analysis;
  const [reachable, dead] =
    analysis.composition === "none"
      ? [analysis.features.reachableStopCount, analysis.features.deadStopCount]
      : [
          analysis.features.reachableStateCount,
          analysis.features.deadStateCount,
        ];
  return [
    {
      label: "最少手数",
      value: `${features.optimalMoveCount}（解 ${features.optimalSolutionCount}）`,
      mono: true,
    },
    {
      label: analysis.composition === "none" ? "到達停止点" : "到達状態",
      value: String(reachable),
      mono: true,
    },
    { label: "詰み", value: String(dead), mono: true },
    { label: "一本道", value: String(features.forcedMoveCount), mono: true },
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
            ...listAnalysisItems(difficultyAnalysis),
          ],
        },
        ...(difficultyAnalysis.status === "analyzed"
          ? [
              {
                title: "盤面の構造",
                items: listBoardItems(difficultyAnalysis),
              },
            ]
          : []),
      ]}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
