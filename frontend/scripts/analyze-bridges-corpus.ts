import {
  assessBridgesDifficulty,
  type BridgesDifficulty,
} from "@/games/bridges/difficulty";
import {
  analyzeBridgesDifficulty,
  type BridgesDifficultyAnalysis,
} from "@/games/bridges/problem/difficulty-analysis";
import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { bridgesReasoningTiers } from "@/games/bridges/problem/generation/human-solver";
import { tryBridgesNaively } from "@/games/bridges/problem/generation/naive-solver";
import { generateBridgesProblem } from "@/games/bridges/problem/generator";
import {
  type BridgesGenerationConditions,
  bridgesBoardSizes,
  bridgesDoubleBridgeRates,
  bridgesExtraBridgeRates,
  bridgesIslandDensities,
  createBridgesProblemIdentity,
} from "@/games/bridges/problem/problem";
import { formatBridgesBoard } from "@/games/bridges/puzzle/board";
import { difficultyLevels } from "@/games/difficulty";
import { createProblemSeededRandom } from "@/games/problem-seed";

const usage = `Usage: bun run analyze:bridges -- [options]

全生成条件（盤面の一辺 × 島の密度 × 2本の割合 × 輪の割合）で、候補番号 0 から決まった数の候補を作り、
分析・分類して、生成条件ごとの収率と、レベルごとの特徴の分布（10 / 50 / 90 パーセンタイル）を出す。
問題集の生成と同じ identity・分析・分類を使うので、問題集の候補空間を決める比較に使う。

Options:
  --per-condition <n>  生成条件ごとの候補数 (default: 150)
  --unconnected        つながりを無視した解の数（上限20）と、慣れた試し置きの戻した回数も測る（遅い）`;

type Row = {
  conditions: BridgesGenerationConditions;
  candidateIndex: number;
  milliseconds: number;
  outcome: string;
  difficulty: BridgesDifficulty | null;
  analysis: BridgesDifficultyAnalysis;
  doubleBridgeShare: number | null;
  unconnectedSolutionCount: number | null;
  mostConstrainedBacktrackCount: number | null;
};

function readOption(name: string): string | undefined {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] : undefined;
}

function listAllConditions(): BridgesGenerationConditions[] {
  return bridgesBoardSizes.flatMap((size) =>
    bridgesIslandDensities.flatMap((islandDensity) =>
      bridgesDoubleBridgeRates.flatMap((doubleBridgeRate) =>
        bridgesExtraBridgeRates.map((extraBridgeRate) => ({
          size,
          islandDensity,
          doubleBridgeRate,
          extraBridgeRate,
        })),
      ),
    ),
  );
}

function conditionKeyOf({
  size,
  islandDensity,
  doubleBridgeRate,
  extraBridgeRate,
}: BridgesGenerationConditions): string {
  return `${size}×${size} d${islandDensity} p${doubleBridgeRate} e${extraBridgeRate}`;
}

function quantile(sorted: readonly number[], ratio: number): number {
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, sorted.length - 1);
  return (
    sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
  );
}

function describe(values: readonly number[], digits = 0): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  return [0.1, 0.5, 0.9]
    .map((ratio) => quantile(sorted, ratio).toFixed(digits))
    .join(" / ");
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return quantile(sorted, 0.5);
}

/** 順位相関（Spearman）。同順位は平均の順位にする。 */
function rankCorrelation(left: readonly number[], right: readonly number[]) {
  function ranks(values: readonly number[]): number[] {
    const order = values
      .map((value, index) => ({ value, index }))
      .sort((a, b) => a.value - b.value);
    const result = values.map(() => 0);
    for (let start = 0; start < order.length; ) {
      let end = start;
      while (
        end + 1 < order.length &&
        order[end + 1]!.value === order[start]!.value
      ) {
        end += 1;
      }
      for (let position = start; position <= end; position += 1) {
        result[order[position]!.index] = (start + end) / 2;
      }
      start = end + 1;
    }
    return result;
  }
  const leftRanks = ranks(left);
  const rightRanks = ranks(right);
  const leftMean = leftRanks.reduce((a, b) => a + b, 0) / leftRanks.length;
  const rightMean = rightRanks.reduce((a, b) => a + b, 0) / rightRanks.length;
  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;
  for (const [index, leftRank] of leftRanks.entries()) {
    const a = leftRank - leftMean;
    const b = rightRanks[index]! - rightMean;
    numerator += a * b;
    leftSquares += a * a;
    rightSquares += b * b;
  }
  const denominator = Math.sqrt(leftSquares * rightSquares);
  return denominator === 0 ? "-" : (numerator / denominator).toFixed(2);
}

function analyzeCandidate(
  conditions: BridgesGenerationConditions,
  candidateIndex: number,
  measuresUnconnected: boolean,
): Row {
  const started = performance.now();
  const identity = createBridgesProblemIdentity(conditions, candidateIndex);
  const { problem, solution } = generateBridgesProblem(identity);
  const analysis = analyzeBridgesDifficulty(problem);
  const assessment = assessBridgesDifficulty(analysis);
  const milliseconds = performance.now() - started;
  const bridged = solution.filter((count) => count > 0);
  const extra =
    measuresUnconnected && analysis.status === "analyzed"
      ? {
          unconnectedSolutionCount: countBridgesSolutions(problem, {
            limit: 20,
            ignoresConnectivity: true,
            nodeLimit: 100_000,
          }).solutionCount,
          mostConstrainedBacktrackCount: median(
            [0, 1, 2, 3, 4].map(
              (trial) =>
                tryBridgesNaively(
                  problem,
                  createProblemSeededRandom(
                    `bridges-naive-mc:${trial}:${formatBridgesBoard(problem).join("/")}`,
                  ),
                  "most-constrained",
                ).backtrackCount,
            ),
          ),
        }
      : { unconnectedSolutionCount: null, mostConstrainedBacktrackCount: null };
  return {
    conditions,
    candidateIndex,
    milliseconds,
    outcome:
      assessment.status === "classified"
        ? `L${assessment.difficulty}`
        : assessment.status === "out-of-range"
          ? assessment.reason
          : assessment.status,
    difficulty:
      assessment.status === "classified" ? assessment.difficulty : null,
    analysis,
    doubleBridgeShare:
      bridged.length === 0
        ? null
        : bridged.filter((count) => count === 2).length / bridged.length,
    ...extra,
  };
}

type ClassifiedRow = Row & {
  difficulty: BridgesDifficulty;
  analysis: Extract<BridgesDifficultyAnalysis, { requiresTrial: false }>;
};

function isClassified(row: Row): row is ClassifiedRow {
  return row.difficulty !== null;
}

function printConditionYields(rows: readonly Row[]): void {
  console.log("\n## 生成条件ごとの収率（候補に対する割合）");
  console.log(
    "| 生成条件 | 候補 | 一意 | 試し置きが要る | L1 | L2 | L3 | L4 | L5 | ms p50 / p95 |",
  );
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---|");
  const groups = Map.groupBy(rows, (row) => conditionKeyOf(row.conditions));
  for (const [key, group] of groups) {
    const share = (predicate: (row: Row) => boolean) =>
      `${((group.filter(predicate).length / group.length) * 100).toFixed(1)}%`;
    const times = group.map((row) => row.milliseconds).sort((a, b) => a - b);
    console.log(
      `| ${key} | ${group.length} | ${share((row) => row.analysis.status !== "invalid")} | ${share((row) => row.outcome === "requires-trial")} | ${difficultyLevels
        .map(({ id }) => share((row) => row.difficulty === id))
        .join(
          " | ",
        )} | ${quantile(times, 0.5).toFixed(1)} / ${quantile(times, 0.95).toFixed(1)} |`,
    );
  }
}

type ReasonedRow = Row & {
  analysis: Extract<BridgesDifficultyAnalysis, { requiresTrial: false }>;
};

function isReasoned(row: Row): row is ReasonedRow {
  return row.analysis.status === "analyzed" && !row.analysis.requiresTrial;
}

/** 分類する前の、推理で解ける一意解の候補全体で、系統どうしが独立かを見る（B4）。 */
function printSystemCorrelations(rows: readonly Row[]): void {
  const reasoned = rows.filter(isReasoned);
  const series: readonly [string, (row: ReasonedRow) => number][] = [
    ["盤面", (row) => row.analysis.scale.size],
    ["島の数", (row) => row.analysis.scale.islandCount],
    ["A2", (row) => row.analysis.reasoning.countRoundCount],
    ["つながり", (row) => row.analysis.reasoning.connectivityRoundCount],
    [
      "決まらない割合",
      (row) => row.analysis.reasoning.countReasoningUndecidedRatio,
    ],
    ["N2戻し", (row) => row.analysis.trial.medianBacktrackCount],
    ["入口", (row) => row.analysis.reasoning.openingEdgeRatio],
  ];
  for (const [title, group] of [
    ["推理で解ける一意解の候補全体", reasoned],
    [
      "そのうち 10×10",
      reasoned.filter((row) => row.analysis.scale.size === 10),
    ],
  ] as const) {
    console.log(`\n## 系統どうしの順位相関（${title}、${group.length}問）`);
    console.log(`| | ${series.map(([name]) => name).join(" | ")} |`);
    console.log(`|---|${series.map(() => "---|").join("")}`);
    for (const [name, getValue] of series) {
      console.log(
        `| ${name} | ${series
          .map(([, other]) =>
            rankCorrelation(group.map(getValue), group.map(other)),
          )
          .join(" | ")} |`,
      );
    }
  }
}

function printLevelDistributions(rows: readonly ClassifiedRow[]): void {
  const byLevel = difficultyLevels.map(({ id }) =>
    rows.filter((row) => row.difficulty === id),
  );
  const features: readonly [
    string,
    (row: ClassifiedRow) => number | null,
    number,
  ][] = [
    ["盤面の一辺", (row) => row.analysis.scale.size, 0],
    ["島の数", (row) => row.analysis.scale.islandCount, 0],
    ["行き先の数", (row) => row.analysis.scale.edgeCount, 0],
    ["橋の本数", (row) => row.analysis.scale.bridgeCount, 0],
    ["入口 ÷ 行き先", (row) => row.analysis.reasoning.openingEdgeRatio, 2],
    ["A2 の手詰まり", (row) => row.analysis.reasoning.countRoundCount, 0],
    [
      "つながりの手詰まり",
      (row) => row.analysis.reasoning.connectivityRoundCount,
      0,
    ],
    [
      "数字だけで決まらない割合",
      (row) => row.analysis.reasoning.countReasoningUndecidedRatio,
      2,
    ],
    [
      "N2 戻し（中央値/問）",
      (row) => row.analysis.trial.medianBacktrackCount,
      0,
    ],
    [
      "N2 全島ちょうどで非連結",
      (row) => row.analysis.trial.medianDisconnectedFullCount,
      0,
    ],
    [
      "N2 戻し0で解けた割合",
      (row) => row.analysis.trial.firstTrySolvedRatio,
      2,
    ],
    ["2本橋の割合", (row) => row.doubleBridgeShare, 2],
    ["連結を無視した解の数", (row) => row.unconnectedSolutionCount, 0],
    ["慣れた試し置きの戻し", (row) => row.mostConstrainedBacktrackCount, 0],
  ];
  console.log("\n## レベルごとの分布（10 / 50 / 90 パーセンタイル）");
  console.log(
    `| 特徴 | ${difficultyLevels.map(({ id }) => `L${id}`).join(" | ")} |`,
  );
  console.log(`|---|${difficultyLevels.map(() => "---|").join("")}`);
  console.log(`| 件数 | ${byLevel.map((group) => group.length).join(" | ")} |`);
  for (const [name, getValue, digits] of features) {
    console.log(
      `| ${name} | ${byLevel
        .map((group) =>
          describe(
            group.flatMap((row) => {
              const value = getValue(row);
              return value === null ? [] : [value];
            }),
            digits,
          ),
        )
        .join(" | ")} |`,
    );
  }

  console.log("\n## 推論の種類の出現（各段が1回以上現れる問題の割合）");
  for (const [index, group] of byLevel.entries()) {
    console.log(
      `L${index + 1}: ${bridgesReasoningTiers
        .filter((tier) => tier !== "T")
        .map(
          (tier) =>
            `${tier} ${((group.filter((row) => row.analysis.reasoning.roundCountByTier[tier] > 0).length / Math.max(1, group.length)) * 100).toFixed(0)}%`,
        )
        .join(" ")}`,
    );
  }

  console.log("\n## レベルの中の盤面ごとの中央値（C2）");
  for (const [index, group] of byLevel.entries()) {
    for (const [size, sized] of Map.groupBy(
      group,
      (row) => row.analysis.scale.size,
    )) {
      console.log(
        `L${index + 1} ${size}×${size}: n=${sized.length} 島 ${median(sized.map((row) => row.analysis.scale.islandCount))} 決まらない割合 ${median(sized.map((row) => row.analysis.reasoning.countReasoningUndecidedRatio)).toFixed(2)} N2戻し ${median(sized.map((row) => row.analysis.trial.medianBacktrackCount))}`,
      );
    }
  }

  console.log("\n## 生成条件の内訳（E2）");
  for (const [index, group] of byLevel.entries()) {
    const describeKey = (key: string) =>
      [
        ...Map.groupBy(group, (row) =>
          key === "p"
            ? row.conditions.doubleBridgeRate
            : key === "d"
              ? row.conditions.islandDensity
              : row.conditions.extraBridgeRate,
        ),
      ]
        .sort(([a], [b]) => a - b)
        .map(([value, items]) => `${value}:${items.length}`)
        .join(" ");
    console.log(
      `L${index + 1}: 2本 ${describeKey("p")} / 密度 ${describeKey("d")} / 輪 ${describeKey("e")}`,
    );
  }

  console.log("\n## 系統どうしの順位相関（分類された問題）");
  const series: readonly [string, (row: ClassifiedRow) => number][] = [
    ["レベル", (row) => Number(row.difficulty)],
    ["盤面", (row) => row.analysis.scale.size],
    ["島の数", (row) => row.analysis.scale.islandCount],
    ["つながり", (row) => row.analysis.reasoning.connectivityRoundCount],
    [
      "決まらない割合",
      (row) => row.analysis.reasoning.countReasoningUndecidedRatio,
    ],
    ["N2戻し", (row) => row.analysis.trial.medianBacktrackCount],
    ["入口", (row) => row.analysis.reasoning.openingEdgeRatio],
  ];
  console.log(`| | ${series.map(([name]) => name).join(" | ")} |`);
  console.log(`|---|${series.map(() => "---|").join("")}`);
  for (const [name, getValue] of series) {
    console.log(
      `| ${name} | ${series
        .map(([, other]) =>
          rankCorrelation(rows.map(getValue), rows.map(other)),
        )
        .join(" | ")} |`,
    );
  }
}

function runMain(): void {
  const perCondition = Number(readOption("per-condition") ?? 150);
  const measuresUnconnected = Bun.argv.includes("--unconnected");
  const started = performance.now();
  const rows = listAllConditions().flatMap((conditions) =>
    Array.from({ length: perCondition }, (_, candidateIndex) =>
      analyzeCandidate(conditions, candidateIndex, measuresUnconnected),
    ),
  );
  console.log(
    `候補 ${rows.length}（生成条件ごと ${perCondition}）を ${((performance.now() - started) / 1_000).toFixed(1)} 秒で分析`,
  );
  const outcomes = Map.groupBy(rows, (row) => row.outcome);
  console.log(
    [...outcomes]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([outcome, group]) => `${outcome} ${group.length}`)
      .join(" / "),
  );
  printConditionYields(rows);
  printSystemCorrelations(rows);
  printLevelDistributions(rows.filter(isClassified));
}

if (Bun.argv.includes("--help")) {
  console.log(usage);
} else {
  runMain();
}
