import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  assessBridgesDifficulty,
  type BridgesDifficulty,
  listBridgesGenerationConditions,
} from "@/games/bridges/difficulty";
import {
  analyzeBridgesDifficulty,
  type BridgesDifficultyAnalysis,
} from "@/games/bridges/problem/difficulty-analysis";
import { getBridgesSymmetryKey } from "@/games/bridges/problem/generation/symmetry";
import { generateBridgesProblem } from "@/games/bridges/problem/generator";
import {
  BRIDGES_GENERATOR_VERSION,
  type BridgesGenerationConditions,
  createBridgesProblemIdentity,
} from "@/games/bridges/problem/problem";
import {
  type BridgesProblemPoolEntry,
  encodeBridgesPoolClues,
  encodeBridgesPoolIslands,
  listBridgesPoolEntries,
  toBridgesPoolAnalysis,
  toBridgesPooledProblem,
} from "@/games/bridges/problem/problem-pool";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import {
  formatBridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import { difficultyLevels } from "@/games/difficulty";

const defaultPerLevel = 500;
const defaultBudget = 20_000;

const usage = `Usage: bun run generate:bridges-pool -- [options]

レベルごとに、レベルの盤面の範囲に入る全生成条件（盤面の一辺 × 島の密度 × 2本の割合 × 輪の割合）で、
決定的な seed の候補を番号順に生成・分析・分類する。そのレベルに分類された候補を、回転・反転（8通り）の
同型の重複をレベルをまたいで除きながら、生成条件を巡回して1問ずつ問題集へ採る。

Options:
  --per-level <n>  レベルごとの問題数 (default: ${defaultPerLevel})
  --budget <n>     生成条件ごとに調べる候補数の上限 (default: ${defaultBudget})
  --verify         生成せず、同梱の問題集の全問を identity から作り直して盤面の一致を確かめ、一意性確認→分析→分類し、
                   レベル・分析結果・同型と seed の重複・JSON の大きさ・選択時間を確かめる`;

const outputPath = new URL(
  "../src/games/bridges/problem/problem-pool.json",
  import.meta.url,
);

type Candidate = {
  conditions: BridgesGenerationConditions;
  candidateIndex: number;
  milliseconds: number;
  outcome: string;
  difficulty: BridgesDifficulty | null;
  entry: BridgesProblemPoolEntry | null;
  symmetryKey: string;
  analysis: BridgesDifficultyAnalysis;
};

function readOption(name: string): string | undefined {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] : undefined;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(readOption(name) ?? fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`--${name} must be a positive integer`);
  }
  return value;
}

function conditionKeyOf({
  size,
  islandDensity,
  doubleBridgeRate,
  extraBridgeRate,
  splitRate,
}: BridgesGenerationConditions): string {
  return `${size}×${size}/d${islandDensity}/p${doubleBridgeRate}/e${extraBridgeRate}/s${splitRate}`;
}

function toPercent(rate: number): number {
  return Math.round(rate * 100);
}

function toPoolEntry(
  conditions: BridgesGenerationConditions,
  candidateIndex: number,
  analysis: Extract<BridgesDifficultyAnalysis, { requiresTrial: false }>,
  board: Parameters<typeof encodeBridgesPoolIslands>[0],
): BridgesProblemPoolEntry {
  const { reasoning, trial, scale } = analysis;
  return [
    conditions.size,
    toPercent(conditions.islandDensity),
    toPercent(conditions.doubleBridgeRate),
    toPercent(conditions.extraBridgeRate),
    toPercent(conditions.splitRate),
    candidateIndex,
    encodeBridgesPoolIslands(board),
    encodeBridgesPoolClues(board),
    reasoning.countRoundCount,
    reasoning.connectivityRoundCount,
    Math.round(reasoning.countReasoningUndecidedRatio * scale.edgeCount),
    trial.medianBacktrackCount,
  ];
}

function evaluateCandidate(
  conditions: BridgesGenerationConditions,
  candidateIndex: number,
): Candidate {
  const started = performance.now();
  const identity = createBridgesProblemIdentity(conditions, candidateIndex);
  const { problem, symmetryKey } = generateBridgesProblem(identity);
  const analysis = analyzeBridgesDifficulty(problem);
  const assessment = assessBridgesDifficulty(analysis);
  const classified =
    assessment.status === "classified" &&
    analysis.status === "analyzed" &&
    !analysis.requiresTrial;
  return {
    conditions,
    candidateIndex,
    milliseconds: performance.now() - started,
    outcome:
      assessment.status === "classified"
        ? `L${assessment.difficulty}`
        : assessment.status === "out-of-range"
          ? assessment.reason
          : assessment.status,
    difficulty: classified ? assessment.difficulty : null,
    entry: classified
      ? toPoolEntry(conditions, candidateIndex, analysis, problem)
      : null,
    symmetryKey,
    analysis,
  };
}

function quantile(sorted: readonly number[], ratio: number): number {
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, sorted.length - 1);
  return (
    sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
  );
}

function describeDistribution(values: readonly number[], digits = 0): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  return [0, 0.1, 0.5, 0.9, 1]
    .map((ratio) => quantile(sorted, ratio).toFixed(digits))
    .join(" / ");
}

function formatCounts(values: readonly (string | number)[]): string {
  const counts = new Map<string | number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([value, count]) => `${value}:${count}`)
    .join(" ");
}

function formatPoolJson(
  levels: Record<BridgesDifficulty, readonly BridgesProblemPoolEntry[]>,
): string {
  const levelLines = difficultyLevels.map(({ id }, index) => {
    const entries = levels[id].map((entry) => `      ${JSON.stringify(entry)}`);
    const separator = index === difficultyLevels.length - 1 ? "" : ",";
    return `    "${id}": [\n${entries.join(",\n")}\n    ]${separator}`;
  });
  return `{\n  "generatorVersion": ${JSON.stringify(BRIDGES_GENERATOR_VERSION)},\n  "levels": {\n${levelLines.join("\n")}\n  }\n}\n`;
}

function describeSize(json: string): string {
  const bytes = Buffer.byteLength(json);
  return `${(bytes / 1024).toFixed(1)} KiB（gzip ${(gzipSync(json).length / 1024).toFixed(1)} KiB）`;
}

/** 問題集の1問の、分布を見る値。 */
function describeEntries(
  difficulty: BridgesDifficulty,
  entries: readonly BridgesProblemPoolEntry[],
): string[] {
  const pooled = entries.map(toBridgesPooledProblem);
  const edgeCounts = pooled.map(
    ({ problem }) => getBridgesNetwork(problem).edges.length,
  );
  return [
    `L${difficulty}: ${entries.length}問`,
    `  盤面の一辺 ${formatCounts(entries.map(([size]) => size))}`,
    `  島の密度(%) ${formatCounts(entries.map((entry) => entry[1]))} / 2本(%) ${formatCounts(entries.map((entry) => entry[2]))} / 輪(%) ${formatCounts(entries.map((entry) => entry[3]))} / 分割(%) ${formatCounts(entries.map((entry) => entry[4]))}`,
    `  島の数 ${describeDistribution(pooled.map(({ problem }) => problem.islands.length))}`,
    `  行き先の数 ${describeDistribution(edgeCounts)}`,
    `  A2 の手詰まり ${describeDistribution(pooled.map(({ analysis }) => analysis.countRoundCount))}`,
    `  つながりの手詰まり ${describeDistribution(pooled.map(({ analysis }) => analysis.connectivityRoundCount))}`,
    `  数字だけで決まらない割合 ${describeDistribution(
      pooled.map(
        ({ analysis }, index) =>
          analysis.countReasoningUndecidedEdgeCount / edgeCounts[index]!,
      ),
      2,
    )}`,
    `  N2 戻し ${describeDistribution(pooled.map(({ analysis }) => analysis.trialBacktrackCount))}`,
  ];
}

type LevelSelection = {
  entries: BridgesProblemPoolEntry[];
  candidateCount: number;
  outcomes: Map<string, number>;
  milliseconds: number[];
};

/**
 * 1つのレベルの問題を採る。生成条件を巡回し、各条件で次に当たる候補（候補番号の順）を1問ずつ採る。
 * 回転・反転で同じ形の問題は、別のレベルで採ったものも含めて除く。
 */
function selectLevel(
  difficulty: BridgesDifficulty,
  perLevel: number,
  budget: number,
  takenKeys: Set<string>,
): LevelSelection {
  const conditions = listBridgesGenerationConditions(difficulty);
  const nextIndex = conditions.map(() => 0);
  const exhausted = conditions.map(() => false);
  const selection: LevelSelection = {
    entries: [],
    candidateCount: 0,
    outcomes: new Map(),
    milliseconds: [],
  };
  while (selection.entries.length < perLevel) {
    if (exhausted.every(Boolean)) {
      throw new Error(
        `Level ${difficulty} ran out of candidates at ${selection.entries.length} problems`,
      );
    }
    for (const [conditionIndex, condition] of conditions.entries()) {
      if (selection.entries.length >= perLevel || exhausted[conditionIndex]) {
        continue;
      }
      for (;;) {
        if (nextIndex[conditionIndex]! >= budget) {
          exhausted[conditionIndex] = true;
          break;
        }
        const candidate = evaluateCandidate(
          condition,
          nextIndex[conditionIndex]!,
        );
        nextIndex[conditionIndex]! += 1;
        selection.candidateCount += 1;
        selection.milliseconds.push(candidate.milliseconds);
        selection.outcomes.set(
          candidate.outcome,
          (selection.outcomes.get(candidate.outcome) ?? 0) + 1,
        );
        if (
          candidate.difficulty === difficulty &&
          candidate.entry !== null &&
          !takenKeys.has(candidate.symmetryKey)
        ) {
          takenKeys.add(candidate.symmetryKey);
          selection.entries.push(candidate.entry);
          break;
        }
      }
    }
  }
  console.log(
    `L${difficulty}: 条件 ${conditions.length} 個で候補 ${selection.candidateCount} を調べた（${conditions
      .map(
        (condition, index) =>
          `${conditionKeyOf(condition)}=${nextIndex[index]}`,
      )
      .join(" ")}）`,
  );
  return selection;
}

function runMain(): void {
  const perLevel = readPositiveInteger("per-level", defaultPerLevel);
  const budget = readPositiveInteger("budget", defaultBudget);
  const started = performance.now();
  const takenKeys = new Set<string>();
  const levels = {} as Record<BridgesDifficulty, BridgesProblemPoolEntry[]>;
  const selections = difficultyLevels.map(({ id }) => {
    const selection = selectLevel(id, perLevel, budget, takenKeys);
    levels[id] = selection.entries;
    return { id, selection };
  });
  const json = formatPoolJson(levels);
  writeFileSync(outputPath, json);

  console.log(
    `\n${((performance.now() - started) / 1_000).toFixed(1)} 秒で生成。${describeSize(json)}`,
  );
  for (const { id, selection } of selections) {
    const times = [...selection.milliseconds].sort((a, b) => a - b);
    console.log(
      `L${id}: 候補 ${selection.candidateCount}・採用率 ${((selection.entries.length / selection.candidateCount) * 100).toFixed(1)}%・1候補 p50 ${quantile(times, 0.5).toFixed(1)}ms p95 ${quantile(times, 0.95).toFixed(1)}ms・内訳 ${formatCounts(
        [...selection.outcomes].flatMap(([outcome, count]) =>
          Array.from({ length: count }, () => outcome),
        ),
      )}`,
    );
  }
  console.log("\n分布（最小 / 10 / 50 / 90 / 最大）");
  for (const { id } of difficultyLevels) {
    console.log(describeEntries(id, levels[id]).join("\n"));
  }
}

type VerifyFailure = {
  difficulty: BridgesDifficulty;
  index: number;
  reason: string;
};

function verifyEntry(
  difficulty: BridgesDifficulty,
  entry: BridgesProblemPoolEntry,
): string | null {
  const pooled = toBridgesPooledProblem(entry);
  const regenerated = generateBridgesProblem(pooled.identity);
  if (
    formatBridgesBoard(regenerated.problem).join("/") !==
    formatBridgesBoard(pooled.problem).join("/")
  ) {
    return "identity から作り直した盤面が違う";
  }
  const analysis = analyzeBridgesDifficulty(pooled.problem);
  if (analysis.status !== "analyzed") {
    return `分析の状態が ${analysis.status}`;
  }
  const assessment = assessBridgesDifficulty(analysis);
  if (
    assessment.status !== "classified" ||
    assessment.difficulty !== difficulty ||
    analysis.requiresTrial
  ) {
    return `分類が L${difficulty} でない（${assessment.status === "classified" ? `L${assessment.difficulty}` : assessment.status}）`;
  }
  const expected = toPoolEntry(
    pooled.identity.conditions,
    entry[5],
    analysis,
    pooled.problem,
  );
  if (
    JSON.stringify(toBridgesPoolAnalysis(expected)) !==
    JSON.stringify(pooled.analysis)
  ) {
    return "分析結果が問題集の値と違う";
  }
  return null;
}

function measureSelection(): string {
  const started = performance.now();
  const count = 2_000;
  for (let index = 0; index < count; index += 1) {
    const { id } = difficultyLevels[index % difficultyLevels.length]!;
    selectBridgesProblemForDifficulty(id, `verify-${index}`);
  }
  return `${((performance.now() - started) / count).toFixed(3)}ms/問`;
}

function runVerify(): void {
  const started = performance.now();
  const failures: VerifyFailure[] = [];
  const keys = new Map<string, string>();
  const seeds = new Set<string>();
  let duplicateCount = 0;
  let seedDuplicateCount = 0;
  for (const { id } of difficultyLevels) {
    for (const [index, entry] of listBridgesPoolEntries(id).entries()) {
      const reason = verifyEntry(id, entry);
      if (reason !== null) {
        failures.push({ difficulty: id, index, reason });
      }
      const pooled = toBridgesPooledProblem(entry);
      const key = getBridgesSymmetryKey(pooled.problem);
      if (keys.has(key)) {
        duplicateCount += 1;
      }
      keys.set(key, `L${id}#${index}`);
      if (seeds.has(pooled.identity.seed)) {
        seedDuplicateCount += 1;
      }
      seeds.add(pooled.identity.seed);
    }
  }
  const json = JSON.stringify(
    Object.fromEntries(
      difficultyLevels.map(({ id }) => [id, listBridgesPoolEntries(id)]),
    ),
  );
  console.log(
    `全 ${seeds.size + seedDuplicateCount} 問を ${((performance.now() - started) / 1_000).toFixed(1)} 秒で確かめた`,
  );
  for (const { id } of difficultyLevels) {
    console.log(`L${id}: ${listBridgesPoolEntries(id).length}問`);
  }
  console.log(
    `同型の重複 ${duplicateCount}・seed の重複 ${seedDuplicateCount}`,
  );
  console.log(
    `問題集の大きさ（項目だけ）${describeSize(json)}・選択 ${measureSelection()}`,
  );
  console.log("\n分布（最小 / 10 / 50 / 90 / 最大）");
  for (const { id } of difficultyLevels) {
    console.log(describeEntries(id, listBridgesPoolEntries(id)).join("\n"));
  }
  if (failures.length > 0 || duplicateCount > 0 || seedDuplicateCount > 0) {
    for (const failure of failures.slice(0, 20)) {
      console.error(
        `L${failure.difficulty}#${failure.index}: ${failure.reason}`,
      );
    }
    throw new Error(
      `Bridges problem pool verification failed: ${failures.length} entries, ${duplicateCount} symmetric duplicates, ${seedDuplicateCount} seed duplicates`,
    );
  }
  console.log("\n不一致 0");
}

if (Bun.argv.includes("--help")) {
  console.log(usage);
} else if (Bun.argv.includes("--verify")) {
  runVerify();
} else {
  runMain();
}
