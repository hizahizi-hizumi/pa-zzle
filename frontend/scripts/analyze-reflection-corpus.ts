import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  assessReflectionDifficulty,
  listReflectionGenerationConditions,
  type ReflectionDifficulty,
  type ReflectionDifficultyAssessment,
  reflectionDifficulties,
} from "@/games/reflection/difficulty";
import {
  analyzeReflectionDifficulty,
  type ReflectionDifficultyAnalysis,
} from "@/games/reflection/problem/difficulty-analysis";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import {
  createReflectionProblemIdentity,
  isReflectionBoardSize,
  type ReflectionBoardSize,
} from "@/games/reflection/problem/problem";
import type { ReflectionBoard } from "@/games/reflection/puzzle/board";

const usage = `Usage: bun run analyze:reflection -- --output <path-prefix> [options]

Options:
  --sizes <n,...>        盤面の一辺 (default: 5,6,7)
  --pieces <n,...>       ピース数 (default: 2,3,4,5,6,7,8,9,10,11,12)
  --seeds <n>            条件ごとの seed 数 (default: 60)
  --jobs <n>             並列ワーカー数 (default: 1)
  --output <path-prefix> <path-prefix>.jsonl と <path-prefix>.csv へ出力する`;

type CorpusTask = {
  size: ReflectionBoardSize;
  pieceCount: number;
  index: number;
};

type CorpusRecord = {
  seed: string;
  size: number;
  pieceCount: number;
  generationAttemptCount: number;
  generationMilliseconds: number;
  analysisMilliseconds: number;
  solution: string;
  difficultyAnalysis: ReflectionDifficultyAnalysis;
  assessment: ReflectionDifficultyAssessment;
};

type FlatRecord = Record<string, string | number | null>;

const cellNotationByPiece = {
  slash: "/",
  backslash: "\\",
  "vertical-double": "|",
  "horizontal-double": "=",
  reflector: "o",
  "black-hole": "@",
} as const;

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

function readIntegerList(name: string, fallback: string): number[] {
  return (readOption(name) ?? fallback).split(",").map((text) => {
    const value = Number(text);
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError(`Invalid --${name} value: ${text}`);
    }
    return value;
  });
}

function formatBoard(board: ReflectionBoard): string {
  const notation = board.cells.map((cell) =>
    cell === null ? "." : cellNotationByPiece[cell],
  );
  return Array.from({ length: board.size }, (_, row) =>
    notation.slice(row * board.size, (row + 1) * board.size).join(""),
  ).join(" ");
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

function analyzeTask({ size, pieceCount, index }: CorpusTask): CorpusRecord {
  const identity = createReflectionProblemIdentity(size, pieceCount, index);
  const generationStartedAt = performance.now();
  const generated = generateReflectionProblem(identity);
  const analysisStartedAt = performance.now();
  const difficultyAnalysis = analyzeReflectionDifficulty(generated.problem);
  const analysisEndedAt = performance.now();
  return {
    seed: identity.seed,
    size,
    pieceCount,
    generationAttemptCount: generated.generationAttemptCount,
    generationMilliseconds: roundMilliseconds(
      analysisStartedAt - generationStartedAt,
    ),
    analysisMilliseconds: roundMilliseconds(
      analysisEndedAt - analysisStartedAt,
    ),
    solution: formatBoard(generated.problem.solution),
    difficultyAnalysis,
    assessment: assessReflectionDifficulty(difficultyAnalysis),
  };
}

function describeReasoning(analysis: ReflectionDifficultyAnalysis): string {
  return analysis.status === "analyzed"
    ? `L${analysis.features.highestLevel}`
    : analysis.status;
}

function describeAssessment(
  assessment: ReflectionDifficultyAssessment,
): string {
  switch (assessment.status) {
    case "classified":
      return assessment.difficulty;
    case "out-of-range":
      return "out-of-range";
    default:
      return assessment.status;
  }
}

function flattenRecord(record: CorpusRecord): FlatRecord {
  const analysis = record.difficultyAnalysis;
  const flat: FlatRecord = {
    seed: record.seed,
    size: record.size,
    pieceCount: record.pieceCount,
    pieceKindCount: analysis.scale.pieceKindCount,
    generationAttemptCount: record.generationAttemptCount,
    generationMilliseconds: record.generationMilliseconds,
    analysisMilliseconds: record.analysisMilliseconds,
    reasoning: describeReasoning(analysis),
    level: describeAssessment(record.assessment),
  };
  if (analysis.status === "analyzed") {
    const { fixedPieceCountByLevel, highestLevel, ...features } =
      analysis.features;
    flat.highestLevel = highestLevel;
    for (const [order, count] of fixedPieceCountByLevel.entries()) {
      flat[`fixedPieceCountL${order + 1}`] = count;
    }
    Object.assign(flat, features);
  }
  return { ...flat, solution: record.solution };
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
    for (let position = start; position <= end; position += 1) {
      ranks[order[position]!.index] = (start + end) / 2 + 1;
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

function quantile(sortedValues: readonly number[], ratio: number): number {
  return sortedValues[
    Math.min(sortedValues.length - 1, Math.floor(ratio * sortedValues.length))
  ]!;
}

function formatNumber(value: number | null): string {
  return value === null ? "-" : String(Math.round(value * 1000) / 1000);
}

function summarizeTimes(values: readonly number[]): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  return `${formatNumber(quantile(sorted, 0.5))} / ${formatNumber(quantile(sorted, 0.9))} / ${formatNumber(quantile(sorted, 0.99))} / ${formatNumber(sorted.at(-1)!)}`;
}

const reasoningOrder = [
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "unsupported",
  "invalid",
] as const;
const levelOrder = [
  ...reflectionDifficulties.map(({ id }) => id),
  "out-of-range",
  "unsupported",
  "invalid",
] as const;

function conditionKey(record: FlatRecord): string {
  return `${record.size}x${record.size}/${record.pieceCount}`;
}

function printConditionSummary(records: readonly FlatRecord[]): void {
  console.log("## 条件ごとの推論レベル・分類・生成の作り直し・分析時間");
  console.log(
    [
      "condition",
      ...reasoningOrder,
      "|",
      ...levelOrder.map((level) => `Lv${level}`),
      "|",
      "rejectRate",
      "analysis ms (p50 / p90 / p99 / max)",
    ].join("\t"),
  );
  for (const [key, group] of Map.groupBy(records, conditionKey)) {
    const reasoningCounts = reasoningOrder.map(
      (reasoning) =>
        group.filter((record) => record.reasoning === reasoning).length,
    );
    const levelCounts = levelOrder.map(
      (level) => group.filter((record) => record.level === level).length,
    );
    const attemptCount = group.reduce(
      (sum, record) => sum + Number(record.generationAttemptCount),
      0,
    );
    console.log(
      [
        key,
        ...reasoningCounts,
        "|",
        ...levelCounts,
        "|",
        formatNumber(1 - group.length / attemptCount),
        summarizeTimes(
          group.map((record) => Number(record.analysisMilliseconds)),
        ),
      ].join("\t"),
    );
  }
}

function printLevelScale(records: readonly FlatRecord[]): void {
  console.log("\n## レベルごとの盤面サイズ・ピース数の内訳（問題数）");
  for (const { id } of reflectionDifficulties) {
    const group = records.filter((record) => record.level === id);
    const bySize = [...Map.groupBy(group, (record) => String(record.size))]
      .map(([size, rows]) => `${size}x${size}:${rows.length}`)
      .join(" ");
    const byPieces = [
      ...Map.groupBy(group, (record) => Number(record.pieceCount)),
    ]
      .sort(([left], [right]) => left - right)
      .map(([count, rows]) => `${count}:${rows.length}`)
      .join(" ");
    console.log(`Lv${id}\tn=${group.length}\t${bySize}\t| pieces ${byPieces}`);
  }
}

const featureColumns = [
  "pieceCount",
  "pieceKindCount",
  "propagationRoundCount",
  "assumptionTestCount",
  "assumptionEliminationCount",
  "fixedPieceCountL1",
] as const;

function printFeaturesByLevel(records: readonly FlatRecord[]): void {
  console.log("\n## レベルごとの特徴量（中央値 (四分位)）");
  console.log(
    ["feature", ...reflectionDifficulties.map(({ id }) => id)].join("\t"),
  );
  for (const column of featureColumns) {
    const cells = reflectionDifficulties.map(({ id }) => {
      const values = records
        .filter((record) => record.level === id)
        .map((record) => Number(record[column]))
        .sort((left, right) => left - right);
      return values.length === 0
        ? "-"
        : `${formatNumber(quantile(values, 0.5))} (${formatNumber(quantile(values, 0.25))}〜${formatNumber(quantile(values, 0.75))})`;
    });
    console.log([column, ...cells].join("\t"));
  }
}

function printScaleCorrelations(records: readonly FlatRecord[]): void {
  const analyzed = records.filter(
    (record) => record.highestLevel !== undefined,
  );
  const levels = analyzed.map((record) => Number(record.highestLevel));
  console.log("\n## 最高推論レベルと規模の Spearman 相関 (analyzed)");
  for (const column of ["pieceCount", "size", "pieceKindCount"] as const) {
    console.log(
      `${column}\t${formatNumber(
        spearmanCorrelation(
          levels,
          analyzed.map((record) => Number(record[column])),
        ),
      )}`,
    );
  }
  const mixedConditions = [...Map.groupBy(analyzed, conditionKey)].filter(
    ([, group]) =>
      new Set(group.map((record) => record.highestLevel)).size >= 3,
  ).length;
  console.log(
    `3種類以上の推論レベルが混ざる条件: ${mixedConditions} / ${new Set(analyzed.map(conditionKey)).size}`,
  );
}

function printSupply(records: readonly FlatRecord[]): void {
  console.log(
    "\n## レベルごとの供給（規模の範囲内の候補のうち、そのレベルに分類された割合と、採用1問あたりの生成＋分析時間）",
  );
  for (const { id } of reflectionDifficulties) {
    const conditionKeys = new Set(
      listReflectionGenerationConditions(id).map(
        ({ size, pieceCount }) => `${size}x${size}/${pieceCount}`,
      ),
    );
    const candidates = records.filter((record) =>
      conditionKeys.has(conditionKey(record)),
    );
    const accepted = candidates.filter((record) => record.level === id);
    const totalMilliseconds = candidates.reduce(
      (sum, record) =>
        sum +
        Number(record.generationMilliseconds) +
        Number(record.analysisMilliseconds),
      0,
    );
    const bestCondition = [...Map.groupBy(candidates, conditionKey)]
      .map(([key, group]) => ({
        key,
        share:
          group.filter((record) => record.level === id).length / group.length,
      }))
      .sort((left, right) => right.share - left.share)[0];
    console.log(
      `Lv${id}\t${accepted.length} / ${candidates.length} (${formatNumber(accepted.length / Math.max(1, candidates.length))})\t${formatNumber(accepted.length === 0 ? null : totalMilliseconds / accepted.length)} ms/問\t最も出やすい条件 ${bestCondition?.key ?? "-"} (${formatNumber(bestCondition?.share ?? null)})`,
    );
  }
}

function isInLevelScale(record: FlatRecord, difficulty: ReflectionDifficulty) {
  return listReflectionGenerationConditions(difficulty).some(
    ({ size, pieceCount }) =>
      record.size === size && record.pieceCount === pieceCount,
  );
}

function printSharedScale(records: readonly FlatRecord[]): void {
  console.log(
    "\n## 隣り合うレベルが共有する規模（両方の範囲に入る盤面サイズ・ピース数）での分類の内訳",
  );
  for (const [order, { id: lower }] of reflectionDifficulties.entries()) {
    const upper = reflectionDifficulties[order + 1]?.id;
    if (upper === undefined) {
      continue;
    }
    const shared = records.filter(
      (record) =>
        isInLevelScale(record, lower) && isInLevelScale(record, upper),
    );
    const conditions = [...new Set(shared.map(conditionKey))].join(" ");
    const lowerCount = shared.filter((record) => record.level === lower).length;
    const upperCount = shared.filter((record) => record.level === upper).length;
    console.log(
      `Lv${lower}/Lv${upper}\t${conditions}\tLv${lower}=${lowerCount} Lv${upper}=${upperCount} ほか=${shared.length - lowerCount - upperCount}`,
    );
  }
}

function printTimesBySize(records: readonly FlatRecord[]): void {
  console.log("\n## 盤面サイズごとの時間 (ms: p50 / p90 / p99 / max)");
  for (const [size, group] of Map.groupBy(records, (record) =>
    String(record.size),
  )) {
    console.log(
      `${size}x${size}\t生成 ${summarizeTimes(group.map((record) => Number(record.generationMilliseconds)))}\t分析 ${summarizeTimes(group.map((record) => Number(record.analysisMilliseconds)))}`,
    );
  }
}

function createTasks(): CorpusTask[] {
  const sizes = readIntegerList("sizes", "5,6,7").map((size) => {
    if (!isReflectionBoardSize(size)) {
      throw new RangeError(`Unsupported board size: ${size}`);
    }
    return size;
  });
  const pieceCounts = readIntegerList("pieces", "2,3,4,5,6,7,8,9,10,11,12");
  const seedCount = readPositiveInteger("seeds", 60);
  return sizes.flatMap((size) =>
    pieceCounts.flatMap((pieceCount) =>
      Array.from({ length: seedCount }, (_, index) => ({
        size,
        pieceCount,
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
    throw new Error(`Reflection corpus worker ${jobIndex} failed`);
  }
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CorpusRecord);
}

function compareTasks(left: CorpusRecord, right: CorpusRecord): number {
  return (
    left.size - right.size ||
    left.pieceCount - right.pieceCount ||
    left.seed.localeCompare(right.seed, "en", { numeric: true })
  );
}

async function runMain(): Promise<void> {
  const outputPrefix = readOption("output");
  if (!outputPrefix || Bun.argv.includes("--help")) {
    console.log(usage);
    process.exitCode = outputPrefix ? 0 : 1;
    return;
  }

  const jobCount = readPositiveInteger("jobs", 1);
  const records = (
    jobCount === 1
      ? createTasks().map(analyzeTask)
      : (
          await Promise.all(
            Array.from({ length: jobCount }, (_, jobIndex) =>
              runJobInWorker(jobIndex),
            ),
          )
        ).flat()
  ).sort(compareTasks);

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
  printConditionSummary(flatRecords);
  printLevelScale(flatRecords);
  printFeaturesByLevel(flatRecords);
  printScaleCorrelations(flatRecords);
  printSupply(flatRecords);
  printSharedScale(flatRecords);
  printTimesBySize(flatRecords);
}

const workerIndex = Bun.argv.indexOf("--worker");
if (workerIndex >= 0) {
  runWorker(Number(Bun.argv[workerIndex + 1]));
} else {
  await runMain();
}
