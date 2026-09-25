import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { MinesweeperDifficultyAnalysis } from "@/games/minesweeper/problem/difficulty-analysis";
import { minesweeperDeductionLevels } from "@/games/minesweeper/problem/generation/human-solver";
import { generateMinesweeperProblem } from "@/games/minesweeper/problem/generator";
import type { MinesweeperStartCellPlacement } from "@/games/minesweeper/problem/problem";

const usage = `Usage: bun run analyze:minesweeper -- --output <path-prefix> [options]

Options:
  --sizes <RxC,...>        盤面サイズの集合 (default: 9x9,12x10,16x12)
  --densities <d,...>      地雷密度の集合 (default: 0.12,0.15,0.18,0.21)
  --seeds <n>              条件ごとの seed 数 (default: 200)
  --start <random|center>  開始マスの決め方 (default: random)
  --jobs <n>               並列ワーカー数 (default: 1)
  --output <path-prefix>   <path-prefix>.jsonl と <path-prefix>.csv へ出力する`;

type CorpusCondition = {
  rows: number;
  columns: number;
  mineCount: number;
  startCellPlacement: MinesweeperStartCellPlacement;
};

type CorpusTask = CorpusCondition & { index: number };

type CorpusRecord = {
  seed: string;
  rows: number;
  columns: number;
  mineCount: number;
  startCellPlacement: MinesweeperStartCellPlacement;
  analysisMilliseconds: number;
  difficultyAnalysis: MinesweeperDifficultyAnalysis;
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

function parseSizes(value: string): { rows: number; columns: number }[] {
  return value.split(",").map((size) => {
    const match = /^(\d+)x(\d+)$/.exec(size.trim());
    if (!match) {
      throw new RangeError(`Invalid board size: ${size}`);
    }
    return { rows: Number(match[1]), columns: Number(match[2]) };
  });
}

function parseDensities(value: string): number[] {
  return value.split(",").map((density) => {
    const parsed = Number(density);
    if (!(parsed > 0 && parsed < 1)) {
      throw new RangeError(`Invalid density: ${density}`);
    }
    return parsed;
  });
}

function parseStartCellPlacement(
  value: string | undefined,
): MinesweeperStartCellPlacement {
  if (value === undefined || value === "random" || value === "center") {
    return value ?? "random";
  }
  throw new RangeError(`Invalid start cell placement: ${value}`);
}

function createSeed({ rows, columns, mineCount, index }: CorpusTask): string {
  return `ms-${rows}x${columns}-${mineCount}-${index}`;
}

function analyzeTask(task: CorpusTask): CorpusRecord {
  const seed = createSeed(task);
  const startedAt = performance.now();
  const generated = generateMinesweeperProblem({
    seed,
    conditions: {
      rows: task.rows,
      columns: task.columns,
      mineCount: task.mineCount,
      startCellPlacement: task.startCellPlacement,
    },
    maximumAttempts: 1,
  });

  return {
    seed,
    rows: task.rows,
    columns: task.columns,
    mineCount: task.mineCount,
    startCellPlacement: task.startCellPlacement,
    analysisMilliseconds:
      Math.round((performance.now() - startedAt) * 100) / 100,
    difficultyAnalysis: generated.difficultyAnalysis,
  };
}

function flattenRecord(record: CorpusRecord): FlatRecord {
  const analysis = record.difficultyAnalysis;
  const flat: FlatRecord = {
    seed: record.seed,
    rows: record.rows,
    columns: record.columns,
    startCellPlacement: record.startCellPlacement,
    analysisMilliseconds: record.analysisMilliseconds,
    status: analysis.status,
    reason: analysis.status === "unsupported" ? analysis.reason : null,
    ...analysis.scale,
  };
  if (analysis.status !== "analyzed") {
    return flat;
  }

  const { roundCountByDeductionLevel, ...features } = analysis.features;
  for (const level of minesweeperDeductionLevels) {
    flat[`level${level}RoundCount`] = roundCountByDeductionLevel[level];
  }
  return { ...flat, ...features };
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

const scaleColumns = [
  "cellCount",
  "mineCount",
  "mineDensity",
  "initialRevealedCellCount",
  "safeCellCountToReveal",
] as const;

function printStatusSummary(records: readonly FlatRecord[]): void {
  const groups = new Map<string, Map<string, number>>();
  for (const record of records) {
    const groupKey = `${record.rows}x${record.columns} mines=${record.mineCount}`;
    const statusKey =
      record.reason === null
        ? String(record.status)
        : `${record.status}:${record.reason}`;
    const group = groups.get(groupKey) ?? new Map<string, number>();
    group.set(statusKey, (group.get(statusKey) ?? 0) + 1);
    groups.set(groupKey, group);
  }

  console.log("## 状態の内訳");
  for (const [groupKey, statuses] of groups) {
    const total = [...statuses.values()].reduce((sum, count) => sum + count, 0);
    const parts = [...statuses.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([status, count]) =>
          `${status}=${count} (${Math.round((count / total) * 1000) / 10}%)`,
      );
    console.log(`${groupKey}: ${parts.join(", ")}`);
  }
}

function listFeatureColumns(records: readonly FlatRecord[]): string[] {
  const excluded = new Set<string>([
    "seed",
    "rows",
    "columns",
    "startCellPlacement",
    "status",
    "reason",
    "analysisMilliseconds",
    ...scaleColumns,
  ]);
  return [...new Set(records.flatMap((record) => Object.keys(record)))].filter(
    (column) => !excluded.has(column),
  );
}

function printFeatureSummary(records: readonly FlatRecord[]): void {
  const analyzed = records.filter((record) => record.status === "analyzed");
  console.log(`\n## 特徴量の分布 (analyzed ${analyzed.length}件)`);
  console.log("feature\tmin\tp25\tmedian\tp75\tmax\tmean");
  for (const column of listFeatureColumns(analyzed)) {
    const values = analyzed
      .map((record) => numericValue(record[column]))
      .filter((value) => value !== null)
      .sort((left, right) => left - right);
    if (values.length === 0) {
      continue;
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    console.log(
      [
        column,
        ...[0, 0.25, 0.5, 0.75, 1].map((ratio) =>
          formatNumber(quantile(values, ratio)),
        ),
        formatNumber(mean),
      ].join("\t"),
    );
  }

  const usages = new Map<string, number>();
  for (const record of analyzed) {
    const usage = String(record.totalMineCountUsage);
    usages.set(usage, (usages.get(usage) ?? 0) + 1);
  }
  console.log(
    `totalMineCountUsage: ${[...usages.entries()].map(([usage, count]) => `${usage}=${count}`).join(", ")}`,
  );

  console.log("\n## 規模指標との Spearman 相関 (analyzed)");
  console.log(["feature", ...scaleColumns].join("\t"));
  for (const column of listFeatureColumns(analyzed)) {
    const pairs = analyzed.flatMap((record) => {
      const value = numericValue(record[column]);
      return value === null ? [] : [{ record, value }];
    });
    if (pairs.length === 0) {
      continue;
    }
    const featureValues = pairs.map((pair) => pair.value);
    const correlations = scaleColumns.map((scaleColumn) =>
      formatNumber(
        spearmanCorrelation(
          featureValues,
          pairs.map((pair) => numericValue(pair.record[scaleColumn]) ?? 0),
        ),
      ),
    );
    console.log([column, ...correlations].join("\t"));
  }

  const times = records
    .map((record) => Number(record.analysisMilliseconds))
    .sort((left, right) => left - right);
  console.log(
    `\n## 1問あたりの生成・分析時間 (ms): mean=${formatNumber(times.reduce((sum, time) => sum + time, 0) / times.length)} median=${formatNumber(quantile(times, 0.5))} p95=${formatNumber(quantile(times, 0.95))} max=${formatNumber(times.at(-1) ?? null)}`,
  );
}

function sliceJobTasks(
  tasks: readonly CorpusTask[],
  jobCount: number,
  jobIndex: number,
): CorpusTask[] {
  const batchSize = Math.ceil(tasks.length / jobCount);
  return tasks.slice(jobIndex * batchSize, (jobIndex + 1) * batchSize);
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
    throw new Error(`Minesweeper corpus worker ${jobIndex} failed`);
  }
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CorpusRecord);
}

function createTasks(): CorpusTask[] {
  const sizes = parseSizes(readOption("sizes") ?? "9x9,12x10,16x12");
  const densities = parseDensities(
    readOption("densities") ?? "0.12,0.15,0.18,0.21",
  );
  const seedCount = readPositiveInteger("seeds", 200);
  const startCellPlacement = parseStartCellPlacement(readOption("start"));
  const conditions = new Map<string, CorpusCondition>();
  for (const { rows, columns } of sizes) {
    for (const density of densities) {
      const mineCount = Math.round(rows * columns * density);
      conditions.set(`${rows}x${columns}-${mineCount}`, {
        rows,
        columns,
        mineCount,
        startCellPlacement,
      });
    }
  }
  return [...conditions.values()].flatMap((condition) =>
    Array.from({ length: seedCount }, (_, index) => ({ ...condition, index })),
  );
}

async function runMain(): Promise<void> {
  const outputPrefix = readOption("output");
  if (!outputPrefix || Bun.argv.includes("--help")) {
    console.log(usage);
    process.exitCode = outputPrefix ? 0 : 1;
    return;
  }

  const tasks = createTasks();
  const jobCount = readPositiveInteger("jobs", 1);
  const records =
    jobCount === 1
      ? tasks.map(analyzeTask)
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
  printStatusSummary(flatRecords);
  printFeatureSummary(flatRecords);
}

const workerIndex = Bun.argv.indexOf("--worker");
if (workerIndex >= 0) {
  runWorker(Number(Bun.argv[workerIndex + 1]));
} else {
  await runMain();
}
