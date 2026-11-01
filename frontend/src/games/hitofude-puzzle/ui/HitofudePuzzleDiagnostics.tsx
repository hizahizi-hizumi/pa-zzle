import {
  type InternalDiagnosticSection,
  InternalDiagnosticsDialog,
} from "@/components/InternalDiagnosticsDialog";
import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import { getDifficultyLabel, type NumericRange } from "@/games/difficulty";
import type { HitofudePuzzleDiagnosticSnapshot } from "@/games/hitofude-puzzle/diagnostics";
import {
  type HitofudePuzzleDifficultyAssessment,
  hitofudePuzzleLevelCombinations,
} from "@/games/hitofude-puzzle/difficulty";
import type {
  HitofudePuzzleAnalyzedDifficulty,
  HitofudePuzzleDifficultyAnalysis,
} from "@/games/hitofude-puzzle/problem/difficulty-analysis";
import type { HitofudePuzzleGenerationConditions } from "@/games/hitofude-puzzle/problem/problem";
import { findHitofudePuzzleDirection } from "@/games/hitofude-puzzle/puzzle/board";

type HitofudePuzzleDiagnosticsProps = {
  snapshot: HitofudePuzzleDiagnosticSnapshot;
  onClose: () => void;
};

type DiagnosticItems = InternalDiagnosticSection["items"];

const directionArrows = {
  up: "↑",
  right: "→",
  down: "↓",
  left: "←",
} as const;

const analysisStatusLabels = {
  unresolved: "評価不能（2段仮置きでも決まらない）",
  "computation-limit": "評価不能（作業量の上限）",
  "no-solution": "不成立（解なし）",
  "multiple-solutions": "不成立（解が2つ以上）",
  "search-limit-reached": "不成立（一意性の探索が上限）",
} as const;

const outOfRangeReasonLabels = {
  "too-light": "提供範囲外（迷う分岐なし）",
  "too-heavy": "提供範囲外（2段仮置きを要する）",
  "unlisted-combination": "提供範囲外（組み合わせ外）",
} as const;

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatGenerationConditions({
  size,
  targetAssumptionCount,
}: HitofudePuzzleGenerationConditions): string {
  return `${size}×${size} / 仮置きの目標 ${targetAssumptionCount}回`;
}

/** 段階ごとの数を「段階: 数」で並べる。 */
function formatStageCounts(counts: Readonly<Record<number, number>>): string {
  return Object.entries(counts)
    .map(([stage, count]) => `${stage}: ${count}`)
    .join(" / ");
}

function formatDecided(decided: boolean): string {
  return decided ? "決まる" : "決まらない";
}

function formatRange({ minimum, maximum }: NumericRange, unit: string) {
  if (maximum === Number.POSITIVE_INFINITY) {
    return `${minimum}${unit}以上`;
  }
  return minimum === maximum
    ? `${minimum}${unit}`
    : `${minimum}〜${maximum}${unit}`;
}

/** 正解の道を、始点から進む向きの矢印で表す。 */
function formatSolution(size: number, solution: readonly number[]): string {
  return solution
    .slice(1)
    .map((cell, step) => {
      const direction = findHitofudePuzzleDirection(
        size,
        solution[step]!,
        cell,
      );
      return direction ? directionArrows[direction] : "?";
    })
    .join("");
}

function formatUniqueness({
  uniqueness,
}: HitofudePuzzleDiagnosticSnapshot): string {
  const steps = `探索 ${uniqueness.searchStepCount}節点`;
  if (uniqueness.status === "search-limit-reached") {
    return `上限で打ち切り（${steps}）`;
  }
  const verdict =
    uniqueness.solutionCount === 1
      ? "一意"
      : uniqueness.solutionCount === 0
        ? "解なし"
        : "解が2つ以上";
  return `${verdict}（${steps}）`;
}

function formatAnalysisStatus(
  analysis: HitofudePuzzleDifficultyAnalysis,
): string {
  return analysis.status === "analyzed"
    ? "分析済み"
    : analysisStatusLabels[analysis.reason];
}

function formatAssessment(
  assessment: HitofudePuzzleDifficultyAssessment,
): string {
  switch (assessment.status) {
    case "classified":
      return getDifficultyLabel(assessment.difficulty);
    case "out-of-range":
      return outOfRangeReasonLabels[assessment.reason];
    case "unsupported":
      return "評価不能";
    case "invalid":
      return "不成立";
  }
}

/** 分類したレベルの組み合わせの各条件に、この問題の値を並べる。 */
function listLevelConditions(
  assessment: HitofudePuzzleDifficultyAssessment,
  analysis: HitofudePuzzleDifficultyAnalysis,
): DiagnosticItems {
  if (assessment.status !== "classified" || analysis.status !== "analyzed") {
    return [];
  }
  const combination: {
    localReasoningSuffices: boolean;
    assumptionCount: NumericRange;
    boardSize: NumericRange;
    minimumLongestRefutationLength?: number;
  } = hitofudePuzzleLevelCombinations[assessment.difficulty];
  const { reasoning, scale } = analysis;
  return [
    {
      label: "局所の推論だけで",
      value: `${formatDecided(reasoning.localReasoningSuffices)}（条件 ${formatDecided(combination.localReasoningSuffices)}）`,
    },
    {
      label: "仮置き",
      value: `${reasoning.assumptionCount}回（条件 ${formatRange(combination.assumptionCount, "回")}）`,
      mono: true,
    },
    {
      label: "盤面サイズ",
      value: `${scale.size}×${scale.size}（条件 ${formatRange(combination.boardSize, "")}）`,
      mono: true,
    },
    ...(combination.minimumLongestRefutationLength === undefined
      ? []
      : [
          {
            label: "最も長い先読み",
            value: `${reasoning.longestRefutationLength}手（条件 ${combination.minimumLongestRefutationLength}手以上）`,
            mono: true,
          },
        ]),
  ];
}

function listBoardItems({
  difficultyAnalysis: { scale },
  straightRatio,
}: HitofudePuzzleDiagnosticSnapshot): DiagnosticItems {
  // 同型キーは盤面の記法（8×8 で8行）をつないだ長い文字列で、一覧では読めないので、再現用JSONにだけ収める。
  return [
    { label: "穴", value: `${scale.holeCount}マス`, mono: true },
    { label: "有効マス", value: `${scale.openCellCount}マス`, mono: true },
    {
      label: "直進率",
      value: straightRatio === null ? "取得なし" : formatPercent(straightRatio),
      mono: true,
    },
  ];
}

function listSolutionItems(
  snapshot: HitofudePuzzleDiagnosticSnapshot,
): DiagnosticItems {
  const { solution, difficultyAnalysis } = snapshot;
  return [
    { label: "一意性", value: formatUniqueness(snapshot), mono: true },
    {
      label: "正解の道",
      value: solution
        ? formatSolution(difficultyAnalysis.scale.size, solution)
        : "取得なし",
      mono: true,
      breakAll: true,
    },
  ];
}

function listReasoningItems({
  reasoning,
}: HitofudePuzzleAnalyzedDifficulty): DiagnosticItems {
  const refutationStepCount = reasoning.refutationLengths.reduce(
    (sum, length) => sum + length,
    0,
  );
  return [
    {
      label: "推論の発火",
      value: formatStageCounts(reasoning.firingCountByStage),
      mono: true,
      breakAll: true,
    },
    {
      label: "分断・パリティ",
      value: reasoning.regionalReasoningUsed ? "使った" : "使わない",
    },
    {
      label: "止まった回数",
      value: `${reasoning.stallCount}回`,
      mono: true,
    },
    {
      label: "最初に止まった時点",
      value: `辺の${formatPercent(reasoning.firstStallDecidedEdgeRatio)}が決定`,
      mono: true,
    },
    {
      label: "仮置き",
      value: `${reasoning.assumptionCount}回 / 2段 ${reasoning.deepAssumptionCount}回`,
      mono: true,
    },
    {
      label: "先読みの手数",
      value: `合計 ${refutationStepCount}手 / 最長 ${reasoning.longestRefutationLength}手`,
      mono: true,
    },
    {
      label: "仮置きごとの手数",
      value:
        reasoning.refutationLengths.length === 0
          ? "なし"
          : reasoning.refutationLengths.join(", "),
      mono: true,
      breakAll: true,
    },
  ];
}

function listDrawingItems({
  drawing,
}: HitofudePuzzleAnalyzedDifficulty): DiagnosticItems {
  return [
    { label: "分岐", value: `${drawing.branchCount}か所`, mono: true },
    { label: "致命分岐", value: `${drawing.fatalBranchCount}か所`, mono: true },
    {
      label: "見抜く段階",
      value: formatStageCounts(drawing.fatalBranchCountByStage),
      mono: true,
      breakAll: true,
    },
    {
      label: "最大誤進入",
      value:
        drawing.longestTrapLength === null
          ? "探索の上限超"
          : `${drawing.longestTrapLength}マス`,
      mono: true,
    },
  ];
}

function listSections(
  snapshot: HitofudePuzzleDiagnosticSnapshot,
): InternalDiagnosticSection[] {
  const { difficultyAnalysis, difficultyAssessment } = snapshot;
  const analyzed =
    difficultyAnalysis.status === "analyzed" ? difficultyAnalysis : null;
  return [
    {
      title: "レベルの判定",
      items: [
        { label: "判定", value: formatAssessment(difficultyAssessment) },
        ...listLevelConditions(difficultyAssessment, difficultyAnalysis),
      ],
    },
    { title: "盤面", items: listBoardItems(snapshot) },
    { title: "一意解", items: listSolutionItems(snapshot) },
    {
      title: "解法器",
      items: [
        { label: "分析", value: formatAnalysisStatus(difficultyAnalysis) },
        ...(analyzed ? listReasoningItems(analyzed) : []),
      ],
    },
    ...(analyzed
      ? [{ title: "描画視点の分岐", items: listDrawingItems(analyzed) }]
      : []),
  ];
}

export function HitofudePuzzleDiagnostics({
  snapshot,
  onClose,
}: HitofudePuzzleDiagnosticsProps) {
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
