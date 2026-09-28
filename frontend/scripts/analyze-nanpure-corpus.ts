import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  assessNanpureDifficulty,
  type NanpureDifficultyAssessment,
} from "@/games/nanpure/difficulty";
import {
  analyzeNanpureDifficulty,
  type NanpureDifficultyAnalysis,
} from "@/games/nanpure/problem/difficulty-analysis";
import { generateNanpureProblem } from "@/games/nanpure/problem/generator";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import {
  type NanpureTechnique,
  nanpureTechniques,
} from "@/games/nanpure/problem/technique";
import {
  NANPURE_SIZE,
  type NanpureBoard,
  type NanpureCell,
} from "@/games/nanpure/puzzle/board";
import { createProblemSeededRandom } from "@/games/problem-seed";

const usage = `Usage: bun run analyze:nanpure -- --output <path-prefix> [options]

Options:
  --limits <limit,...>   ヒントを減らすときに解き切れることを保つ手筋の上限。
                         ${nanpureTechniques.join(" / ")} / uniqueness（一意解だけを保つ）
                         (default: uniqueness,hidden-single-block,hidden-single-line,naked-single,locked-candidates,hidden-triple,xyz-wing)
  --seeds <n>            条件ごとの seed 数 (default: 400)
  --jobs <n>             並列ワーカー数 (default: 1)
  --transforms <n>       各問題を n 通りの同型変換（行・列・帯の入れ替え、転置、数字の付け替え）でも分析し、分類の変わり方を数える (default: 0)
  --output <path-prefix> <path-prefix>.jsonl と <path-prefix>.csv へ出力する`;

const uniquenessOnly = "uniqueness";
const defaultLimits = [
  uniquenessOnly,
  "hidden-single-block",
  "hidden-single-line",
  "naked-single",
  "locked-candidates",
  "hidden-triple",
  "xyz-wing",
] as const;

type RemovalLimit = NanpureTechnique | typeof uniquenessOnly;

type CorpusTask = { removalLimit: RemovalLimit; index: number };

type TransformResult = {
  level: string;
  deepestTechnique: NanpureTechnique | null;
  deepestTechniqueRoundCount: number | null;
};

type CorpusRecord = {
  seed: string;
  removalLimit: RemovalLimit;
  generationMilliseconds: number;
  clues: string;
  solution: string;
  difficultyAnalysis: NanpureDifficultyAnalysis;
  assessment: NanpureDifficultyAssessment;
  transforms: TransformResult[];
};

type FlatRecord = Record<string, string | number | boolean | null>;

function readOption(name: string): string | undefined {
  const index = Bun.argv.indexOf(`--${name}`);
  return index >= 0 ? Bun.argv[index + 1] : undefined;
}

function readInteger(name: string, fallback: number, minimum: number): number {
  const value = Number(readOption(name) ?? fallback);
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`--${name} must be an integer >= ${minimum}`);
  }
  return value;
}

function isRemovalLimit(value: string): value is RemovalLimit {
  return (
    value === uniquenessOnly ||
    (nanpureTechniques as readonly string[]).includes(value)
  );
}

function parseRemovalLimits(value: string | undefined): RemovalLimit[] {
  if (value === undefined) {
    return [...defaultLimits];
  }
  return value.split(",").map((limit) => {
    const trimmed = limit.trim();
    if (!isRemovalLimit(trimmed)) {
      throw new RangeError(`Invalid removal limit: ${limit}`);
    }
    return trimmed;
  });
}

function formatBoard(board: NanpureBoard): string {
  return board.map((cell) => (cell === null ? "." : String(cell))).join("");
}

function describeAssessment(assessment: NanpureDifficultyAssessment): string {
  switch (assessment.status) {
    case "classified":
      return assessment.difficulty;
    case "out-of-range":
      return `out-of-range:${assessment.reason}`;
    default:
      return assessment.status;
  }
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

/** 帯・帯の中の行・柱・柱の中の列の入れ替え、転置、数字の付け替えを乱数で組み合わせる。どれも手筋の成否を変えない同型変換。 */
function transformBoard(
  board: NanpureBoard,
  random: () => number,
): NanpureBoard {
  function permutation(): number[] {
    return shuffled([0, 1, 2], random).flatMap((band) =>
      shuffled([0, 1, 2], random).map((offset) => band * 3 + offset),
    );
  }
  const rows = permutation();
  const columns = permutation();
  const transpose = random() < 0.5;
  const digits = [0, ...shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], random)];
  return Array.from({ length: NANPURE_SIZE * NANPURE_SIZE }, (_, cellIndex) => {
    const row = Math.floor(cellIndex / NANPURE_SIZE);
    const column = cellIndex % NANPURE_SIZE;
    const [sourceRow, sourceColumn] = transpose
      ? [columns[column]!, rows[row]!]
      : [rows[row]!, columns[column]!];
    const cell = board[sourceRow * NANPURE_SIZE + sourceColumn] ?? null;
    return (cell === null ? null : digits[cell]!) as NanpureCell;
  });
}

function analyzeTransforms(
  seed: string,
  clues: NanpureBoard,
  count: number,
): TransformResult[] {
  const random = createProblemSeededRandom(`transform:${seed}`);
  return Array.from({ length: count }, () => {
    const analysis = analyzeNanpureDifficulty(transformBoard(clues, random));
    return {
      level: describeAssessment(assessNanpureDifficulty(analysis)),
      deepestTechnique:
        analysis.status === "analyzed"
          ? analysis.features.deepestTechnique
          : null,
      deepestTechniqueRoundCount:
        analysis.status === "analyzed"
          ? analysis.features.deepestTechniqueRoundCount
          : null,
    };
  });
}

function analyzeTask(task: CorpusTask, transformCount: number): CorpusRecord {
  const identity = createNanpureProblemIdentity(
    task.removalLimit === uniquenessOnly ? null : task.removalLimit,
    task.index,
  );
  const startedAt = performance.now();
  const generated = generateNanpureProblem(identity);
  const generationMilliseconds =
    Math.round((performance.now() - startedAt) * 100) / 100;
  return {
    seed: identity.seed,
    removalLimit: task.removalLimit,
    generationMilliseconds,
    clues: formatBoard(generated.problem.clues),
    solution: formatBoard(generated.problem.solution),
    difficultyAnalysis: generated.difficultyAnalysis,
    assessment: assessNanpureDifficulty(generated.difficultyAnalysis),
    transforms: analyzeTransforms(
      identity.seed,
      generated.problem.clues,
      transformCount,
    ),
  };
}

function flattenRecord(record: CorpusRecord): FlatRecord {
  const analysis = record.difficultyAnalysis;
  const flat: FlatRecord = {
    seed: record.seed,
    removalLimit: record.removalLimit,
    generationMilliseconds: record.generationMilliseconds,
    level: describeAssessment(record.assessment),
    status: analysis.status,
    ...analysis.scale,
  };
  if (analysis.status !== "analyzed") {
    return { ...flat, clues: record.clues };
  }
  const { roundCountByTechnique, ...features } = analysis.features;
  for (const technique of nanpureTechniques) {
    flat[`${technique}RoundCount`] = roundCountByTechnique[technique];
  }
  return { ...flat, ...features, clues: record.clues };
}

function toCsv(rows: readonly FlatRecord[]): string {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  function formatCell(value: FlatRecord[string] | undefined): string {
    if (value === null || value === undefined) {
      return "";
    }
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }
  return [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => formatCell(row[column])).join(","),
    ),
  ].join("\n");
}

function numericValue(value: FlatRecord[string] | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function quantile(sortedValues: readonly number[], ratio: number): number {
  return sortedValues[
    Math.min(sortedValues.length - 1, Math.floor(ratio * sortedValues.length))
  ]!;
}

function formatNumber(value: number | null): string {
  return value === null ? "-" : String(Math.round(value * 1000) / 1000);
}

function formatQuartiles(values: readonly number[]): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  return `${formatNumber(quantile(sorted, 0.5))} (${formatNumber(quantile(sorted, 0.25))}〜${formatNumber(quantile(sorted, 0.75))})`;
}

const levelOrder = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "out-of-range:too-light",
  "unsupported",
  "invalid",
] as const;
const providedLevels = levelOrder.slice(0, 5);

function printLevelSummary(records: readonly FlatRecord[]): void {
  console.log("## 条件ごとの分類");
  console.log(["removalLimit", ...levelOrder].join("\t"));
  const groups = Map.groupBy(records, (record) => String(record.removalLimit));
  for (const [groupKey, group] of groups) {
    const counts = levelOrder.map(
      (level) => group.filter((record) => record.level === level).length,
    );
    console.log([groupKey, ...counts].join("\t"));
  }
  const totals = levelOrder.map(
    (level) => records.filter((record) => record.level === level).length,
  );
  console.log(["total", ...totals].join("\t"));
}

function printDeepestTechniques(records: readonly FlatRecord[]): void {
  console.log("\n## 条件ごとの最も深い手筋");
  const techniques = [...nanpureTechniques, "unsupported"];
  console.log(["removalLimit", ...techniques].join("\t"));
  const groups = Map.groupBy(records, (record) => String(record.removalLimit));
  for (const [groupKey, group] of groups) {
    const counts = techniques.map(
      (technique) =>
        group.filter((record) =>
          technique === "unsupported"
            ? record.status === "unsupported"
            : record.deepestTechnique === technique,
        ).length,
    );
    console.log([groupKey, ...counts].join("\t"));
  }
}

const featureColumns = [
  "clueCount",
  "roundCount",
  "deepestTechniqueRoundCount",
  "eliminationRoundCount",
  "longestEliminationStreak",
  "meanAvailablePlacementCount",
  "minimumAvailablePlacementCount",
  "singleAvailablePlacementRoundCount",
  "firstEliminationEmptyCellRatio",
] as const;

function printFeaturesByLevel(records: readonly FlatRecord[]): void {
  const analyzed = records.filter((record) => record.status === "analyzed");
  console.log("\n## レベルごとの特徴量（中央値 (四分位)）");
  console.log(["feature", ...providedLevels].join("\t"));
  for (const column of featureColumns) {
    const cells = providedLevels.map((level) =>
      formatQuartiles(
        analyzed
          .filter((record) => record.level === level)
          .map((record) => numericValue(record[column]))
          .filter((value) => value !== null),
      ),
    );
    console.log([column, ...cells].join("\t"));
  }
}

function probabilityOfGreater(
  lower: readonly number[],
  upper: readonly number[],
): number {
  let score = 0;
  for (const lowerValue of lower) {
    for (const upperValue of upper) {
      score +=
        upperValue > lowerValue ? 1 : upperValue === lowerValue ? 0.5 : 0;
    }
  }
  return score / (lower.length * upper.length);
}

type AucGrouping = {
  label: string;
  groupKey: (record: FlatRecord) => string;
};

const withinConditionGrouping: AucGrouping = {
  label: "同条件内",
  groupKey: (record) => String(record.removalLimit),
};

const sameClueCountGrouping: AucGrouping = {
  label: "同じヒント数",
  groupKey: (record) => String(record.clueCount),
};

/**
 * 同じグループの中で隣り合う2レベルから1問ずつ取ったとき、上位レベルの値のほうが大きい確率。
 * 各レベルに10問以上あるグループだけを使い、少ないほうの問題数で重み付けして平均する。
 */
function groupedAuc(
  records: readonly FlatRecord[],
  grouping: AucGrouping,
  column: string,
  lowerLevel: string,
  upperLevel: string,
): number | null {
  const groups = Map.groupBy(records, grouping.groupKey);
  let weightedSum = 0;
  let totalWeight = 0;
  for (const group of groups.values()) {
    function valuesAt(level: string): number[] {
      return group
        .filter((record) => record.level === level)
        .map((record) => numericValue(record[column]))
        .filter((value) => value !== null);
    }
    const lower = valuesAt(lowerLevel);
    const upper = valuesAt(upperLevel);
    if (lower.length < 10 || upper.length < 10) {
      continue;
    }
    const weight = Math.min(lower.length, upper.length);
    weightedSum += weight * probabilityOfGreater(lower, upper);
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

const aucColumns = [
  "clueCount",
  "roundCount",
  "meanAvailablePlacementCount",
  "singleAvailablePlacementRoundCount",
] as const;

const adjacentPairs = [
  ["1", "2"],
  ["2", "3"],
  ["3", "4"],
  ["4", "5"],
] as const;

function printAdjacentLevelAuc(records: readonly FlatRecord[]): void {
  for (const grouping of [withinConditionGrouping, sameClueCountGrouping]) {
    console.log(
      `\n## ${grouping.label} AUC（隣り合うレベルで上位の値が大きい確率。meanAvailablePlacementCount は小さいほど見つけにくい）`,
    );
    console.log(
      [
        "column",
        ...adjacentPairs.map(([lower, upper]) => `${lower}→${upper}`),
      ].join("\t"),
    );
    for (const column of aucColumns) {
      const values = adjacentPairs.map(([lower, upper]) =>
        formatNumber(groupedAuc(records, grouping, column, lower, upper)),
      );
      console.log([column, ...values].join("\t"));
    }
  }
}

function roundCountOf(record: FlatRecord, technique: NanpureTechnique): number {
  return Number(record[`${technique}RoundCount`] ?? 0);
}

function subsetRoundCount(record: FlatRecord): number {
  return (
    ["naked-pair", "hidden-pair", "naked-triple", "hidden-triple"] as const
  ).reduce((sum, technique) => sum + roundCountOf(record, technique), 0);
}

function depthOf(record: FlatRecord): number {
  return nanpureTechniques.indexOf(record.deepestTechnique as NanpureTechnique);
}

/**
 * 5段階の分け方の候補。評価不能・提供範囲外は分け直さない。
 * P1 は `difficulty.ts` の分類そのもの（手筋の系統で分ける）。
 */
const plans = [
  {
    id: "P1",
    description:
      "ブロックのシングル / 行・列とマスのシングル / 重なり / 組 / 行・列の組み合わせと候補のつながり（difficulty.ts）",
    levelOf: (record: FlatRecord) => String(record.level),
  },
  {
    id: "P2",
    description:
      "P1 の 4・5 を、組が2局面以上か行・列の組み合わせ・つながりで 5 に分け直す",
    levelOf: (record: FlatRecord) => {
      if (record.level !== "4" && record.level !== "5") {
        return String(record.level);
      }
      return record.level === "5" || subsetRoundCount(record) >= 2 ? "5" : "4";
    },
  },
  {
    id: "P3",
    description:
      "シングルを3段に分ける: ブロック / 行・列 / マス / 重なり / 組以上",
    levelOf: (record: FlatRecord) => {
      if (
        record.status !== "analyzed" ||
        record.level === "out-of-range:too-light"
      ) {
        return String(record.level);
      }
      const depth = depthOf(record);
      return String(Math.min(5, Math.max(1, depth)));
    },
  },
] as const;

function relabel(
  records: readonly FlatRecord[],
  levelOf: (record: FlatRecord) => string,
): FlatRecord[] {
  return records.map((record) => ({ ...record, level: levelOf(record) }));
}

function printPlanComparison(records: readonly FlatRecord[]): void {
  console.log(
    "\n## 5段階の分け方の比較（各レベルの問題数と、各レベルが最も出やすい条件での割合、同じヒント数での隣接 AUC: roundCount / meanAvailablePlacementCount）",
  );
  for (const plan of plans) {
    const relabeled = relabel(records, plan.levelOf);
    const counts = providedLevels.map(
      (level) => relabeled.filter((record) => record.level === level).length,
    );
    const groups = Map.groupBy(relabeled, withinConditionGrouping.groupKey);
    const shares = providedLevels.map((level) =>
      formatNumber(
        Math.max(
          ...[...groups.values()].map(
            (group) =>
              group.filter((record) => record.level === level).length /
              group.length,
          ),
        ),
      ),
    );
    const aucs = adjacentPairs.map(
      ([lower, upper]) =>
        `${formatNumber(groupedAuc(relabeled, sameClueCountGrouping, "roundCount", lower, upper))}/${formatNumber(groupedAuc(relabeled, sameClueCountGrouping, "meanAvailablePlacementCount", lower, upper))}`,
    );
    console.log(`${plan.id}: ${plan.description}`);
    console.log(`  問題数 ${counts.join(" / ")}`);
    console.log(`  最も出やすい条件での割合 ${shares.join(" / ")}`);
    console.log(`  隣接 AUC ${aucs.join("  ")}`);
  }
}

/**
 * 旧来の3段階（dependency-v1）と同じ「次の一手の見つけやすさ」だけを五分位で5つに切った場合。
 * 手筋の系統とどれだけ食い違うかを見る。
 */
function printDependencyQuintileComparison(
  records: readonly FlatRecord[],
): void {
  const provided = records.filter((record) =>
    (providedLevels as readonly string[]).includes(String(record.level)),
  );
  const values = provided
    .map((record) => Number(record.meanAvailablePlacementCount))
    .sort((left, right) => left - right);
  const cuts = [0.2, 0.4, 0.6, 0.8].map((ratio) => quantile(values, ratio));
  console.log(
    `\n## 次の一手の見つけやすさの五分位（境界 ${cuts.map(formatNumber).join(" / ")}）と P1 の対応`,
  );
  console.log(["quintile", ...providedLevels].join("\t"));
  for (let quintile = 0; quintile < 5; quintile += 1) {
    const members = provided.filter((record) => {
      const value = Number(record.meanAvailablePlacementCount);
      const level = 5 - cuts.filter((cut) => value >= cut).length;
      return level === quintile + 1;
    });
    console.log(
      [
        `Q${quintile + 1}`,
        ...providedLevels.map(
          (level) => members.filter((record) => record.level === level).length,
        ),
      ].join("\t"),
    );
  }
}

function printTransformStability(records: readonly CorpusRecord[]): void {
  const withTransforms = records.filter(
    (record) => record.transforms.length > 0,
  );
  if (withTransforms.length === 0) {
    return;
  }
  let total = 0;
  let sameLevel = 0;
  let sameDeepest = 0;
  let sameDeepestRoundCount = 0;
  for (const record of withTransforms) {
    const level = describeAssessment(record.assessment);
    const analysis = record.difficultyAnalysis;
    for (const transform of record.transforms) {
      total += 1;
      sameLevel += transform.level === level ? 1 : 0;
      if (analysis.status === "analyzed") {
        sameDeepest +=
          transform.deepestTechnique === analysis.features.deepestTechnique
            ? 1
            : 0;
        sameDeepestRoundCount +=
          transform.deepestTechniqueRoundCount ===
          analysis.features.deepestTechniqueRoundCount
            ? 1
            : 0;
      }
    }
  }
  const analyzedTotal = withTransforms
    .filter((record) => record.difficultyAnalysis.status === "analyzed")
    .reduce((sum, record) => sum + record.transforms.length, 0);
  console.log(
    `\n## 同型変換での安定性: ${withTransforms.length}問 × 変換 ${total / withTransforms.length}通り`,
  );
  console.log(
    `  レベル一致 ${sameLevel}/${total} / 最も深い手筋の一致 ${sameDeepest}/${analyzedTotal} / 最も深い手筋のラウンド数の一致 ${sameDeepestRoundCount}/${analyzedTotal}`,
  );
}

function printGenerationTimes(records: readonly FlatRecord[]): void {
  console.log("\n## 1問あたりの生成・分析時間 (ms)");
  const groups = Map.groupBy(records, (record) => String(record.removalLimit));
  for (const [removalLimit, group] of groups) {
    const times = group
      .map((record) => Number(record.generationMilliseconds))
      .sort((left, right) => left - right);
    console.log(
      `${removalLimit}: median=${formatNumber(quantile(times, 0.5))} p95=${formatNumber(quantile(times, 0.95))} max=${formatNumber(times.at(-1) ?? null)}`,
    );
  }
}

function createTasks(): CorpusTask[] {
  const removalLimits = parseRemovalLimits(readOption("limits"));
  const seedCount = readInteger("seeds", 400, 1);
  return removalLimits.flatMap((removalLimit) =>
    Array.from({ length: seedCount }, (_, index) => ({ removalLimit, index })),
  );
}

function runWorker(jobIndex: number): void {
  const jobCount = readInteger("jobs", 1, 1);
  const transformCount = readInteger("transforms", 0, 0);
  createTasks().forEach((task, index) => {
    if (index % jobCount === jobIndex) {
      console.log(JSON.stringify(analyzeTask(task, transformCount)));
    }
  });
}

async function runJobInWorker(jobIndex: number): Promise<CorpusRecord[]> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      ...Bun.argv.slice(2),
      "--worker",
      String(jobIndex),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Nanpure corpus worker ${jobIndex} failed`);
  }
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CorpusRecord);
}

async function runMain(): Promise<void> {
  const outputPrefix = readOption("output");
  if (!outputPrefix || Bun.argv.includes("--help")) {
    console.log(usage);
    process.exitCode = outputPrefix ? 0 : 1;
    return;
  }

  const jobCount = readInteger("jobs", 1, 1);
  const records = (
    await Promise.all(
      Array.from({ length: jobCount }, (_, jobIndex) =>
        runJobInWorker(jobIndex),
      ),
    )
  ).flat();

  mkdirSync(dirname(outputPrefix), { recursive: true });
  writeFileSync(
    `${outputPrefix}.jsonl`,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
  const flatRecords = records.map(flattenRecord);
  writeFileSync(`${outputPrefix}.csv`, `${toCsv(flatRecords)}\n`);

  console.log(
    `${records.length}件を ${outputPrefix}.jsonl / .csv へ出力しました\n`,
  );
  printLevelSummary(flatRecords);
  printDeepestTechniques(flatRecords);
  printFeaturesByLevel(flatRecords);
  printAdjacentLevelAuc(flatRecords);
  printPlanComparison(flatRecords);
  printDependencyQuintileComparison(flatRecords);
  printTransformStability(records);
  printGenerationTimes(flatRecords);
}

const workerIndex = Bun.argv.indexOf("--worker");
if (workerIndex >= 0) {
  runWorker(Number(Bun.argv[workerIndex + 1]));
} else {
  await runMain();
}
