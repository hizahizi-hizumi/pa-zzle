import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  assessTakuzuDifficulty,
  type TakuzuDifficultyAssessment,
} from "@/games/takuzu/difficulty";
import type { TakuzuDifficultyAnalysis } from "@/games/takuzu/problem/difficulty-analysis";
import {
  type TakuzuTechnique,
  takuzuTechniques,
} from "@/games/takuzu/problem/generation/human-solver";
import { generateTakuzuProblem } from "@/games/takuzu/problem/generator";
import type { TakuzuBoard } from "@/games/takuzu/puzzle/board";

const usage = `Usage: bun run analyze:takuzu -- --output <path-prefix> [options]

Options:
  --limits <limit,...>   初期配置を減らすときに解き切れることを保つ手筋の上限。
                         ${takuzuTechniques.join(" / ")} / uniqueness（一意解だけを保つ）
                         (default: すべて)
  --extras <n,...>       減らし切った初期配置へ戻すマスの数 (default: 0,2,4,6,10,14)
  --seeds <n>            条件ごとの seed 数 (default: 200)
  --jobs <n>             並列ワーカー数 (default: 1)
  --output <path-prefix> <path-prefix>.jsonl と <path-prefix>.csv へ出力する`;

const uniquenessOnly = "uniqueness";

type RemovalLimit = TakuzuTechnique | typeof uniquenessOnly;

type CorpusTask = {
  removalLimit: RemovalLimit;
  extraGivenCount: number;
  index: number;
};

type CorpusRecord = {
  seed: string;
  removalLimit: RemovalLimit;
  extraGivenCount: number;
  generationMilliseconds: number;
  givens: string;
  solution: string;
  difficultyAnalysis: TakuzuDifficultyAnalysis;
  assessment: TakuzuDifficultyAssessment;
};

type FlatRecord = Record<string, string | number | boolean | null>;

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

function isRemovalLimit(value: string): value is RemovalLimit {
  return (
    value === uniquenessOnly ||
    (takuzuTechniques as readonly string[]).includes(value)
  );
}

function parseRemovalLimits(value: string | undefined): RemovalLimit[] {
  if (value === undefined) {
    return [...takuzuTechniques, uniquenessOnly];
  }
  return value.split(",").map((limit) => {
    const trimmed = limit.trim();
    if (!isRemovalLimit(trimmed)) {
      throw new RangeError(`Invalid removal limit: ${limit}`);
    }
    return trimmed;
  });
}

function parseExtraGivenCounts(value: string): number[] {
  return value.split(",").map((count) => {
    const parsed = Number(count);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new RangeError(`Invalid extra given count: ${count}`);
    }
    return parsed;
  });
}

function formatBoard(board: TakuzuBoard): string {
  const notation = board.cells.map((cell) =>
    cell === null ? "." : cell.toUpperCase(),
  );
  return Array.from({ length: board.size }, (_, row) =>
    notation.slice(row * board.size, (row + 1) * board.size).join(""),
  ).join("/");
}

function createSeed({
  removalLimit,
  extraGivenCount,
  index,
}: CorpusTask): string {
  return `tk-${removalLimit}-${extraGivenCount}-${index}`;
}

function analyzeTask(task: CorpusTask): CorpusRecord {
  const seed = createSeed(task);
  const startedAt = performance.now();
  const generated = generateTakuzuProblem({
    seed,
    removalTechniqueLimit:
      task.removalLimit === uniquenessOnly ? null : task.removalLimit,
    extraGivenCount: task.extraGivenCount,
  });
  return {
    seed,
    removalLimit: task.removalLimit,
    extraGivenCount: task.extraGivenCount,
    generationMilliseconds:
      Math.round((performance.now() - startedAt) * 100) / 100,
    givens: formatBoard(generated.problem.givens),
    solution: formatBoard(generated.problem.solution),
    difficultyAnalysis: generated.difficultyAnalysis,
    assessment: assessTakuzuDifficulty(generated.difficultyAnalysis),
  };
}

function describeAssessment(assessment: TakuzuDifficultyAssessment): string {
  switch (assessment.status) {
    case "classified":
      return assessment.difficulty;
    case "out-of-range":
      return `out-of-range:${assessment.reason}`;
    default:
      return assessment.status;
  }
}

function flattenRecord(record: CorpusRecord): FlatRecord {
  const analysis = record.difficultyAnalysis;
  const flat: FlatRecord = {
    seed: record.seed,
    removalLimit: record.removalLimit,
    extraGivenCount: record.extraGivenCount,
    generationMilliseconds: record.generationMilliseconds,
    level: describeAssessment(record.assessment),
    status: analysis.status,
    ...analysis.scale,
  };
  if (analysis.status !== "analyzed") {
    return { ...flat, givens: record.givens };
  }
  const { roundCountByTechnique, ...features } = analysis.features;
  for (const technique of takuzuTechniques) {
    flat[`${technique}RoundCount`] = roundCountByTechnique[technique];
  }
  return { ...flat, ...features, givens: record.givens };
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

function rankValues(values: readonly number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (
      end + 1 < order.length &&
      order[end + 1]!.value === order[start]!.value
    ) {
      end += 1;
    }
    const averageRank = (start + end) / 2 + 1;
    for (let position = start; position <= end; position += 1) {
      ranks[order[position]!.index] = averageRank;
    }
    start = end + 1;
  }
  return ranks;
}

function pearsonCorrelation(
  left: readonly number[],
  right: readonly number[],
): number | null {
  const count = left.length;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / count;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / count;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < count; index += 1) {
    const leftDelta = left[index]! - leftMean;
    const rightDelta = right[index]! - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  return leftVariance === 0 || rightVariance === 0
    ? null
    : covariance / Math.sqrt(leftVariance * rightVariance);
}

function spearmanCorrelation(
  left: readonly number[],
  right: readonly number[],
): number | null {
  return left.length < 3
    ? null
    : pearsonCorrelation(rankValues(left), rankValues(right));
}

function numericValue(value: FlatRecord[string] | undefined): number | null {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return null;
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

const scaleColumns = ["givenCount", "emptyCellCount"] as const;
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

function printLevelSummary(records: readonly FlatRecord[]): void {
  console.log("## 条件ごとの分類");
  console.log(["removalLimit", "extra", ...levelOrder].join("\t"));
  const groups = Map.groupBy(
    records,
    (record) => `${record.removalLimit}\t${record.extraGivenCount}`,
  );
  for (const [groupKey, group] of groups) {
    const counts = levelOrder.map(
      (level) => group.filter((record) => record.level === level).length,
    );
    console.log([groupKey, ...counts].join("\t"));
  }
  const totals = levelOrder.map(
    (level) => records.filter((record) => record.level === level).length,
  );
  console.log(["total", "", ...totals].join("\t"));
}

function listFeatureColumns(records: readonly FlatRecord[]): string[] {
  const excluded = new Set<string>([
    "seed",
    "removalLimit",
    "extraGivenCount",
    "generationMilliseconds",
    "level",
    "status",
    "givens",
    "deepestTechnique",
    "cellCount",
  ]);
  return [...new Set(records.flatMap((record) => Object.keys(record)))].filter(
    (column) => !excluded.has(column),
  );
}

function printFeaturesByLevel(records: readonly FlatRecord[]): void {
  const analyzed = records.filter((record) => record.status === "analyzed");
  const levels = levelOrder.slice(0, 6);
  console.log("\n## レベルごとの特徴量（中央値 (四分位)）");
  console.log(["feature", ...levels].join("\t"));
  for (const column of listFeatureColumns(analyzed)) {
    const cells = levels.map((level) =>
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

function printScaleCorrelations(records: readonly FlatRecord[]): void {
  const analyzed = records.filter((record) => record.status === "analyzed");
  console.log("\n## 規模指標との Spearman 相関 (analyzed)");
  console.log(["feature", ...scaleColumns].join("\t"));
  for (const column of listFeatureColumns(analyzed)) {
    if ((scaleColumns as readonly string[]).includes(column)) {
      continue;
    }
    const pairs = analyzed.flatMap((record) => {
      const value = numericValue(record[column]);
      return value === null ? [] : [{ record, value }];
    });
    const correlations = scaleColumns.map((scaleColumn) =>
      formatNumber(
        spearmanCorrelation(
          pairs.map((pair) => pair.value),
          pairs.map((pair) => numericValue(pair.record[scaleColumn]) ?? 0),
        ),
      ),
    );
    console.log([column, ...correlations].join("\t"));
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

/** 同じ生成条件（手筋の上限・戻す数）の中で比べる。 */
const withinConditionGrouping: AucGrouping = {
  label: "同条件内",
  groupKey: (record) => `${record.removalLimit}:${record.extraGivenCount}`,
};

/** 空きマスの数がちょうど同じ問題の中で比べる。規模をそろえてもレベルの差が残るかを見る。 */
const sameEmptyCellCountGrouping: AucGrouping = {
  label: "同じ空きマス数",
  groupKey: (record) => String(record.emptyCellCount),
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
  "emptyCellCount",
  "roundCount",
  "singleSourceRoundCount",
  "meanSourceCount",
] as const;

function printAdjacentLevelAuc(records: readonly FlatRecord[]): void {
  const pairs = [
    ["1", "2"],
    ["2", "3"],
    ["3", "4"],
    ["4", "5"],
  ] as const;
  for (const grouping of [
    withinConditionGrouping,
    sameEmptyCellCountGrouping,
  ]) {
    console.log(
      `\n## ${grouping.label} AUC（隣り合うレベルで上位の値が大きい確率。meanSourceCount は小さいほど見つけにくい）`,
    );
    console.log(
      ["column", ...pairs.map(([lower, upper]) => `${lower}→${upper}`)].join(
        "\t",
      ),
    );
    for (const column of aucColumns) {
      const values = pairs.map(([lower, upper]) =>
        formatNumber(groupedAuc(records, grouping, column, lower, upper)),
      );
      console.log([column, ...values].join("\t"));
    }
  }
}

/**
 * 難易度4 と 5 の分け方の候補。どの案も、D 以上が要る問題（分類上 4 か 5）だけを分け直す。
 * P1 が `difficulty.ts` の現在の分類。
 */
const difficulty5Plans = [
  {
    id: "P1",
    description: "E、または重複の回避が2局面以上",
    isDifficulty5: (record: FlatRecord) =>
      Number(record["general-lineRoundCount"]) > 0 ||
      Number(record.duplicateAvoidanceRoundCount) >= 2,
  },
  {
    id: "P2",
    description: "E、または深い読みが2ラウンド以上続く",
    isDifficulty5: (record: FlatRecord) =>
      Number(record["general-lineRoundCount"]) > 0 ||
      Number(record.longestLineReadingStreak) >= 2,
  },
  {
    id: "P3",
    description: "E だけ",
    isDifficulty5: (record: FlatRecord) =>
      Number(record["general-lineRoundCount"]) > 0,
  },
  {
    id: "P6",
    description: "P1 または P2",
    isDifficulty5: (record: FlatRecord) =>
      Number(record["general-lineRoundCount"]) > 0 ||
      Number(record.duplicateAvoidanceRoundCount) >= 2 ||
      Number(record.longestLineReadingStreak) >= 2,
  },
  {
    id: "P7",
    description:
      "E、または（重複の回避が2局面以上 かつ 深い読みが2ラウンド以上続く）",
    isDifficulty5: (record: FlatRecord) =>
      Number(record["general-lineRoundCount"]) > 0 ||
      (Number(record.duplicateAvoidanceRoundCount) >= 2 &&
        Number(record.longestLineReadingStreak) >= 2),
  },
] as const;

function maximumShareByCondition(
  records: readonly FlatRecord[],
  level: string,
): number {
  const groups = Map.groupBy(records, withinConditionGrouping.groupKey);
  return Math.max(
    ...[...groups.values()].map(
      (group) =>
        group.filter((record) => record.level === level).length / group.length,
    ),
  );
}

function printDifficulty5PlanComparison(records: readonly FlatRecord[]): void {
  console.log(
    "\n## 難易度5 の条件の比較（4 / 5 の問題数、4→5 同条件内 AUC、最も出やすい条件での割合 4 / 5）",
  );
  console.log(
    ["plan", "count 4/5", ...aucColumns, "max share 4/5", "description"].join(
      "\t",
    ),
  );
  for (const plan of difficulty5Plans) {
    const relabeled = records.map((record) =>
      record.level === "4" || record.level === "5"
        ? { ...record, level: plan.isDifficulty5(record) ? "5" : "4" }
        : record,
    );
    const counts = ["4", "5"].map(
      (level) => relabeled.filter((record) => record.level === level).length,
    );
    const aucs = aucColumns.map((column) =>
      formatNumber(
        groupedAuc(relabeled, withinConditionGrouping, column, "4", "5"),
      ),
    );
    const shares = ["4", "5"].map((level) =>
      formatNumber(maximumShareByCondition(relabeled, level)),
    );
    console.log(
      [
        plan.id,
        counts.join(" / "),
        ...aucs,
        shares.join(" / "),
        plan.description,
      ].join("\t"),
    );
  }
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
  const extraGivenCounts = parseExtraGivenCounts(
    readOption("extras") ?? "0,2,4,6,10,14",
  );
  const seedCount = readPositiveInteger("seeds", 200);
  return removalLimits.flatMap((removalLimit) =>
    extraGivenCounts.flatMap((extraGivenCount) =>
      Array.from({ length: seedCount }, (_, index) => ({
        removalLimit,
        extraGivenCount,
        index,
      })),
    ),
  );
}

function sliceJobTasks(
  tasks: readonly CorpusTask[],
  jobCount: number,
  jobIndex: number,
): CorpusTask[] {
  return tasks.filter((_, index) => index % jobCount === jobIndex);
}

function runWorker(jobIndex: number): void {
  const jobCount = readPositiveInteger("jobs", 1);
  for (const task of sliceJobTasks(createTasks(), jobCount, jobIndex)) {
    console.log(JSON.stringify(analyzeTask(task)));
  }
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
    throw new Error(`Takuzu corpus worker ${jobIndex} failed`);
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

  const jobCount = readPositiveInteger("jobs", 1);
  const records =
    jobCount === 1
      ? createTasks().map(analyzeTask)
      : (
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
  printFeaturesByLevel(flatRecords);
  printScaleCorrelations(flatRecords);
  printAdjacentLevelAuc(flatRecords);
  printDifficulty5PlanComparison(flatRecords);
  printGenerationTimes(flatRecords);
}

const workerIndex = Bun.argv.indexOf("--worker");
if (workerIndex >= 0) {
  runWorker(Number(Bun.argv[workerIndex + 1]));
} else {
  await runMain();
}
