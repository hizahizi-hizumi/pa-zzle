import {
  type InternalDiagnosticSection,
  InternalDiagnosticsDialog,
} from "@/components/InternalDiagnosticsDialog";
import type { BridgesDiagnosticSnapshot } from "@/games/bridges/diagnostics";
import {
  type BridgesAssessedFeatures,
  type BridgesDifficultyAssessment,
  type BridgesLevelCombination,
  bridgesLevelCombinations,
} from "@/games/bridges/difficulty";
import type { BridgesDifficultyAnalysis } from "@/games/bridges/problem/difficulty-analysis";
import type { BridgesGenerationConditions } from "@/games/bridges/problem/problem";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel, type NumericRange } from "@/games/difficulty";

type BridgesDiagnosticsProps = {
  snapshot: BridgesDiagnosticSnapshot;
  onClose: () => void;
};

type DiagnosticItems = InternalDiagnosticSection["items"];

type AnalyzedDifficulty = Extract<
  BridgesDifficultyAnalysis,
  { status: "analyzed"; requiresTrial: false }
>;

const outOfRangeReasonLabels = {
  "requires-trial": "提供範囲外（試し置きが要る）",
  "unlisted-combination": "提供範囲外（組み合わせ外）",
} as const;

const invalidReasonLabels = {
  "no-solution": "不成立（解なし）",
  "multiple-solutions": "不成立（解が2つ以上）",
  "search-limit": "不成立（一意性の探索が上限）",
} as const;

/** レベルの組み合わせの条件の名前。並びは組み合わせの定義の順。 */
const levelConditionLabels = {
  boardSize: "盤面の一辺",
  islandCount: "島の数",
  openingEdgeRatio: "入口 ÷ 行き先",
  countRoundCount: "少なくとも1本の手詰まり",
  connectivityRoundCount: "つながりの手詰まり",
  countReasoningUndecidedRatio: "数字だけでは決まらない割合",
} as const satisfies Record<keyof BridgesLevelCombination, string>;

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatGenerationConditions({
  size,
  islandDensity,
  doubleBridgeRate,
  extraBridgeRate,
  splitRate,
}: BridgesGenerationConditions): string {
  return `${size}×${size} / 島の密度 ${islandDensity} / 2本 ${doubleBridgeRate} / 輪 ${extraBridgeRate} / 分割 ${splitRate}`;
}

function formatRange({
  minimum,
  maximum,
  excludesMinimum,
}: NumericRange): string {
  const lower = `${minimum}${excludesMinimum ? "より大" : "以上"}`;
  if (maximum === Number.POSITIVE_INFINITY) {
    return lower;
  }
  return minimum === maximum && !excludesMinimum
    ? `${minimum}`
    : `${lower}・${maximum}以下`;
}

function formatFeature(key: keyof BridgesAssessedFeatures, value: number) {
  return key === "openingEdgeRatio" || key === "countReasoningUndecidedRatio"
    ? value.toFixed(2)
    : `${value}`;
}

function formatAssessment(assessment: BridgesDifficultyAssessment): string {
  switch (assessment.status) {
    case "classified":
      return getDifficultyLabel(assessment.difficulty);
    case "out-of-range":
      return outOfRangeReasonLabels[assessment.reason];
    case "unsupported":
      return "評価不能（試し置きでも決まらない）";
    case "invalid":
      return "不成立";
  }
}

/** 分類したレベルの組み合わせの各条件に、この問題の値を並べる。 */
function listLevelConditions(
  assessment: BridgesDifficultyAssessment,
): DiagnosticItems {
  if (assessment.status !== "classified") {
    return [];
  }
  const combination: BridgesLevelCombination =
    bridgesLevelCombinations[assessment.difficulty];
  return (
    Object.keys(levelConditionLabels) as (keyof BridgesLevelCombination)[]
  ).map((key) => ({
    label: levelConditionLabels[key],
    value: `${formatFeature(key, assessment.features[key])}（条件 ${formatRange(combination[key])}）`,
    mono: true,
  }));
}

function formatAnalysisStatus(analysis: BridgesDifficultyAnalysis): string {
  switch (analysis.status) {
    case "analyzed":
      return analysis.requiresTrial ? "試し置きが要る" : "分析済み";
    case "unsupported":
      return "評価不能（試し置きでも決まらない）";
    case "invalid":
      return invalidReasonLabels[analysis.reason];
  }
}

function formatUniqueness({ uniqueness }: BridgesDiagnosticSnapshot): string {
  const nodes = `探索 ${uniqueness.nodeCount}局面`;
  if (uniqueness.exceededNodeLimit) {
    return `上限で打ち切り（${nodes}）`;
  }
  const verdict =
    uniqueness.solutionCount === 1
      ? "一意"
      : uniqueness.solutionCount === 0
        ? "解なし"
        : "解が2つ以上";
  return `${verdict}（${nodes}）`;
}

function listBoardItems({
  difficultyAnalysis,
}: BridgesDiagnosticSnapshot): DiagnosticItems {
  if (difficultyAnalysis.status === "invalid") {
    return [];
  }
  // 同型キーは盤面の記法をつないだ長い文字列で、一覧では読めないので、再現用JSONにだけ収める。
  const { islandCount, edgeCount, bridgeCount } = difficultyAnalysis.scale;
  return [
    { label: "島", value: `${islandCount}個`, mono: true },
    { label: "行き先", value: `${edgeCount}組`, mono: true },
    { label: "橋", value: `${bridgeCount}本`, mono: true },
  ];
}

function listSolutionItems(
  snapshot: BridgesDiagnosticSnapshot,
): DiagnosticItems {
  return [
    { label: "一意性", value: formatUniqueness(snapshot), mono: true },
    {
      label: "辺ごとの橋の本数",
      value: snapshot.solution ? snapshot.solution.join("") : "取得なし",
      mono: true,
      breakAll: true,
    },
  ];
}

function listReasoningItems({
  reasoning,
}: AnalyzedDifficulty): DiagnosticItems {
  return [
    { label: "最も高い段", value: reasoning.maximumTier, mono: true },
    {
      label: "少なくとも1本の手詰まり",
      value: `${reasoning.countRoundCount}回`,
      mono: true,
    },
    {
      label: "つながりの手詰まり",
      value: `${reasoning.connectivityRoundCount}回`,
      mono: true,
    },
    {
      label: "数字だけでは決まらない",
      value: formatPercent(reasoning.countReasoningUndecidedRatio),
      mono: true,
    },
    {
      label: "入口 ÷ 行き先",
      value: formatPercent(reasoning.openingEdgeRatio),
      mono: true,
    },
  ];
}

function listTrialItems({ trial }: AnalyzedDifficulty): DiagnosticItems {
  return [
    {
      label: "戻した回数（中央値）",
      value: `${trial.medianBacktrackCount}回`,
      mono: true,
    },
    {
      label: "全島ちょうどで非連結（中央値）",
      value: `${trial.medianDisconnectedFullCount}回`,
      mono: true,
    },
    {
      label: "戻さずに解けた試行",
      value: formatPercent(trial.firstTrySolvedRatio),
      mono: true,
    },
  ];
}

function listSections(
  snapshot: BridgesDiagnosticSnapshot,
): InternalDiagnosticSection[] {
  const { difficultyAnalysis, difficultyAssessment, reasoningRounds } =
    snapshot;
  const analyzed =
    difficultyAnalysis.status === "analyzed" &&
    !difficultyAnalysis.requiresTrial
      ? difficultyAnalysis
      : null;
  return [
    {
      title: "レベルの判定",
      items: [
        { label: "判定", value: formatAssessment(difficultyAssessment) },
        ...listLevelConditions(difficultyAssessment),
      ],
    },
    { title: "盤面", items: listBoardItems(snapshot) },
    { title: "一意解", items: listSolutionItems(snapshot) },
    {
      title: "人間向け解法器",
      items: [
        { label: "分析", value: formatAnalysisStatus(difficultyAnalysis) },
        {
          label: "手詰まりごとの段",
          value:
            reasoningRounds.length === 0 ? "なし" : reasoningRounds.join(" "),
          mono: true,
          breakAll: true,
        },
        ...(analyzed ? listReasoningItems(analyzed) : []),
      ],
    },
    ...(analyzed
      ? [{ title: "素朴な解き方", items: listTrialItems(analyzed) }]
      : []),
  ];
}

export function BridgesDiagnostics({
  snapshot,
  onClose,
}: BridgesDiagnosticsProps) {
  return (
    <InternalDiagnosticsDialog
      difficultyLabel={getDifficultyLabel(snapshot.difficulty)}
      seed={snapshot.problemIdentity.seed}
      generatorVersion={snapshot.problemIdentity.generatorVersion}
      generationConditions={formatGenerationConditions(
        snapshot.problemIdentity.conditions,
      )}
      buildRevision={snapshot.buildRevision}
      sections={listSections(snapshot)}
      serializedSnapshot={serializeInternalDiagnosticSnapshot(snapshot)}
      onClose={onClose}
    />
  );
}
