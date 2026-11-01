import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { difficultyLevels } from "@/games/difficulty";
import {
  assessHitofudePuzzleDifficulty,
  type HitofudePuzzleDifficulty,
  type HitofudePuzzleDifficultyAssessment,
  listHitofudePuzzleGenerationConditions,
} from "@/games/hitofude-puzzle/difficulty";
import {
  analyzeHitofudePuzzleDifficulty,
  type HitofudePuzzleDifficultyAnalysis,
} from "@/games/hitofude-puzzle/problem/difficulty-analysis";
import { generateHitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/generator";
import {
  createHitofudePuzzleProblemIdentity,
  type HitofudePuzzleBoardSize,
  type HitofudePuzzleTargetLookaheadLoad,
  hitofudePuzzleTargetLookaheadLoads,
  isHitofudePuzzleBoardSize,
  isHitofudePuzzleTargetLookaheadLoad,
} from "@/games/hitofude-puzzle/problem/problem";
import { formatHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";

const usage = `Usage: bun run analyze:hitofude-puzzle -- --output <path-prefix> [options]

Options:
  --sizes <n,...>        盤面の一辺 (default: 5,6,7,8)
  --targets <n,...>      先読みの重さの目標 (default: ${hitofudePuzzleTargetLookaheadLoads.join(",")})
  --seeds <n>            条件ごとの seed 数 (default: 100)
  --jobs <n>             並列ワーカー数 (default: 1)
  --output <path-prefix> <path-prefix>.jsonl と <path-prefix>.csv へ出力する`;

type CorpusTask = {
  size: HitofudePuzzleBoardSize;
  targetLookaheadLoad: HitofudePuzzleTargetLookaheadLoad;
  index: number;
};

type CorpusRecord = {
  seed: string;
  size: number;
  targetLookaheadLoad: number;
  generationAttemptCount: number;
  generationMilliseconds: number;
  analysisMilliseconds: number;
  board: string;
  difficultyAnalysis: HitofudePuzzleDifficultyAnalysis;
  assessment: HitofudePuzzleDifficultyAssessment;
};

type FlatRecord = Record<string, string | number | null>;

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

function readList<T>(
  name: string,
  fallback: string,
  isValue: (value: unknown) => value is T,
): T[] {
  return (readOption(name) ?? fallback).split(",").map((text) => {
    const value = Number(text);
    if (!isValue(value)) {
      throw new RangeError(`Invalid --${name} value: ${text}`);
    }
    return value;
  });
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

function analyzeTask({
  size,
  targetLookaheadLoad,
  index,
}: CorpusTask): CorpusRecord {
  const identity = createHitofudePuzzleProblemIdentity(
    size,
    targetLookaheadLoad,
    index,
  );
  const generationStartedAt = performance.now();
  const generated = generateHitofudePuzzleProblem(identity);
  const analysisStartedAt = performance.now();
  const difficultyAnalysis = analyzeHitofudePuzzleDifficulty(generated.problem);
  const analysisEndedAt = performance.now();
  return {
    seed: identity.seed,
    size,
    targetLookaheadLoad,
    generationAttemptCount: generated.generationAttemptCount,
    generationMilliseconds: roundMilliseconds(
      analysisStartedAt - generationStartedAt,
    ),
    analysisMilliseconds: roundMilliseconds(
      analysisEndedAt - analysisStartedAt,
    ),
    board: formatHitofudePuzzleBoard(generated.problem).join("/"),
    difficultyAnalysis,
    assessment: assessHitofudePuzzleDifficulty(difficultyAnalysis),
  };
}

/** 先読みの重さの帯。盤面サイズを問わない分類で、分類（レベル）とは別に、条件ごとの分布を見るために出す。 */
function describeBand(analysis: HitofudePuzzleDifficultyAnalysis): string {
  if (analysis.status !== "analyzed") {
    return analysis.status === "invalid" ? "invalid" : "x";
  }
  const { lookaheadLoad, deepAssumptionCount, localReasoningSuffices } =
    analysis.reasoning;
  if (localReasoningSuffices) {
    return "1";
  }
  if (deepAssumptionCount > 0 || lookaheadLoad >= 4) {
    return "5";
  }
  return String(Math.max(2, lookaheadLoad + 1));
}

function describeAssessment(
  assessment: HitofudePuzzleDifficultyAssessment,
): string {
  switch (assessment.status) {
    case "classified":
      return assessment.difficulty;
    case "out-of-range":
      return assessment.reason;
    default:
      return assessment.status;
  }
}

function flattenRecord(record: CorpusRecord): FlatRecord {
  const analysis = record.difficultyAnalysis;
  const flat: FlatRecord = {
    seed: record.seed,
    size: record.size,
    targetLookaheadLoad: record.targetLookaheadLoad,
    openCellCount: analysis.scale.openCellCount,
    holeCount: analysis.scale.holeCount,
    generationAttemptCount: record.generationAttemptCount,
    generationMilliseconds: record.generationMilliseconds,
    analysisMilliseconds: record.analysisMilliseconds,
    band: describeBand(analysis),
    level: describeAssessment(record.assessment),
  };
  if (analysis.status === "analyzed") {
    const { reasoning, drawing } = analysis;
    Object.assign(flat, {
      assumptionCount: reasoning.assumptionCount,
      lookaheadLoad: reasoning.lookaheadLoad,
      deepAssumptionCount: reasoning.deepAssumptionCount,
      longestRefutationLength: reasoning.longestRefutationLength,
      refutationLengths: reasoning.refutationLengths.join(" "),
      stallCount: reasoning.stallCount,
      regionalReasoningUsed: reasoning.regionalReasoningUsed ? 1 : 0,
      firstStallDecidedEdgeRatio:
        Math.round(reasoning.firstStallDecidedEdgeRatio * 1000) / 1000,
      branchCount: drawing.branchCount,
      fatalBranchCount: drawing.fatalBranchCount,
      longestTrapLength: drawing.longestTrapLength,
    });
    for (const [stage, count] of Object.entries(
      drawing.fatalBranchCountByStage,
    )) {
      flat[`fatalBranchStage${stage}`] = count;
    }
  }
  return { ...flat, board: record.board };
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

function summarizeValues(values: readonly number[]): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  return `${formatNumber(quantile(sorted, 0.5))} (${formatNumber(quantile(sorted, 0.25))}〜${formatNumber(quantile(sorted, 0.75))})`;
}

const bandOrder = ["1", "2", "3", "4", "5", "x", "invalid"] as const;
const levelOrder = [
  ...difficultyLevels.map(({ id }) => id),
  "too-light",
  "too-heavy",
  "unlisted-combination",
  "unsupported",
  "invalid",
] as const;

function formatConditionKey(
  size: unknown,
  targetLookaheadLoad: unknown,
): string {
  return `${size}x${size}/t${targetLookaheadLoad}`;
}

function conditionKey(record: FlatRecord): string {
  return formatConditionKey(record.size, record.targetLookaheadLoad);
}

function printConditionSummary(records: readonly FlatRecord[]): void {
  console.log("## 条件ごとの帯（先読みの重さ）・分類・生成の作り直し・時間");
  console.log(
    [
      "condition",
      ...bandOrder.map((band) => `band${band}`),
      "|",
      ...levelOrder.map((level) => `Lv${level}`),
      "|",
      "rejectRate",
      "generation ms (p50 / p90 / p99 / max)",
      "analysis ms (p50 / p90 / p99 / max)",
    ].join("\t"),
  );
  for (const [key, group] of Map.groupBy(records, conditionKey)) {
    const attemptCount = group.reduce(
      (sum, record) => sum + Number(record.generationAttemptCount),
      0,
    );
    console.log(
      [
        key,
        ...bandOrder.map(
          (band) => group.filter((record) => record.band === band).length,
        ),
        "|",
        ...levelOrder.map(
          (level) => group.filter((record) => record.level === level).length,
        ),
        "|",
        formatNumber(1 - group.length / attemptCount),
        summarizeTimes(
          group.map((record) => Number(record.generationMilliseconds)),
        ),
        summarizeTimes(
          group.map((record) => Number(record.analysisMilliseconds)),
        ),
      ].join("\t"),
    );
  }
}

const featureColumns = [
  "openCellCount",
  "holeCount",
  "assumptionCount",
  "lookaheadLoad",
  "longestRefutationLength",
  "stallCount",
  "firstStallDecidedEdgeRatio",
  "regionalReasoningUsed",
  "branchCount",
  "longestTrapLength",
  "fatalBranchStage5",
] as const;

function printFeaturesBy(
  title: string,
  records: readonly FlatRecord[],
  groupKey: "band" | "level",
  groups: readonly string[],
): void {
  console.log(`\n## ${title}（中央値 (四分位)）`);
  console.log(
    ["feature", ...groups.map((group) => `${groupKey}${group}`)].join("\t"),
  );
  console.log(
    [
      "count",
      ...groups.map(
        (group) =>
          records.filter((record) => record[groupKey] === group).length,
      ),
    ].join("\t"),
  );
  for (const column of featureColumns) {
    const cells = groups.map((group) =>
      summarizeValues(
        records
          .filter(
            (record) =>
              record[groupKey] === group &&
              record[column] !== null &&
              record[column] !== undefined,
          )
          .map((record) => Number(record[column])),
      ),
    );
    console.log([column, ...cells].join("\t"));
  }
}

function printLevelScale(records: readonly FlatRecord[]): void {
  console.log(
    "\n## レベルごとの盤面サイズ・先読みの重さの目標の内訳（問題数）",
  );
  for (const { id } of difficultyLevels) {
    const group = records.filter((record) => record.level === id);
    const byCondition = [...Map.groupBy(group, conditionKey)]
      .map(([key, rows]) => `${key}:${rows.length}`)
      .join(" ");
    console.log(`Lv${id}\tn=${group.length}\t${byCondition}`);
  }
}

function printRefutationLengths(records: readonly FlatRecord[]): void {
  console.log(
    "\n## 仮置きの回数ごとの、最も長い先読み（矛盾までの推論の手数）の分布",
  );
  console.log("assumptions\tcount\tlongest p10 / p25 / p50 / p75 / p90");
  const analyzed = records.filter(
    (record) => record.assumptionCount !== undefined,
  );
  for (const [count, group] of [
    ...Map.groupBy(analyzed, (record) =>
      Math.min(10, Number(record.assumptionCount)),
    ),
  ].sort(([left], [right]) => left - right)) {
    const sorted = group
      .map((record) => Number(record.longestRefutationLength))
      .sort((left, right) => left - right);
    console.log(
      `${count === 10 ? "10+" : count}\t${group.length}\t${[0.1, 0.25, 0.5, 0.75, 0.9].map((ratio) => quantile(sorted, ratio)).join(" / ")}`,
    );
  }
}

function printCorrelations(
  title: string,
  records: readonly FlatRecord[],
  columns: readonly string[],
): void {
  console.log(`\n## ${title}`);
  for (const column of columns) {
    const pairs = records.filter((record) => record[column] !== null);
    console.log(
      `${column}\t${formatNumber(
        spearmanCorrelation(
          pairs.map((record) => Number(record.assumptionCount)),
          pairs.map((record) => Number(record[column])),
        ),
      )}`,
    );
  }
}

function printScaleCorrelations(records: readonly FlatRecord[]): void {
  const analyzed = records.filter(
    (record) => record.assumptionCount !== undefined,
  );
  printCorrelations(
    "仮置きの回数と規模・他の特徴の Spearman 相関 (analyzed)",
    analyzed,
    ["size", "openCellCount", "holeCount", "branchCount", "longestTrapLength"],
  );
  printCorrelations(
    "仮置きの回数と最も長い先読みの Spearman 相関 (仮置き1回以上)",
    analyzed.filter((record) => Number(record.assumptionCount) >= 1),
    ["longestRefutationLength"],
  );
  const mixedConditions = [...Map.groupBy(analyzed, conditionKey)].filter(
    ([, group]) => new Set(group.map((record) => record.band)).size >= 3,
  ).length;
  console.log(
    `3種類以上の帯が混ざる条件: ${mixedConditions} / ${new Set(analyzed.map(conditionKey)).size}`,
  );
}

function printSupply(records: readonly FlatRecord[]): void {
  console.log(
    "\n## レベルごとの供給（盤面サイズの範囲内の候補のうち、そのレベルに分類された割合と、採用1問あたりの生成＋分析時間）",
  );
  for (const { id } of difficultyLevels) {
    const conditionKeys = new Set(
      listHitofudePuzzleGenerationConditions(id).map(
        ({ size, targetLookaheadLoad }) =>
          formatConditionKey(size, targetLookaheadLoad),
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
    const byCondition = [...Map.groupBy(candidates, conditionKey)].map(
      ([key, group]) => {
        const acceptedInCondition = group.filter(
          (record) => record.level === id,
        ).length;
        const milliseconds = group.reduce(
          (sum, record) =>
            sum +
            Number(record.generationMilliseconds) +
            Number(record.analysisMilliseconds),
          0,
        );
        return `${key} ${formatNumber(acceptedInCondition / group.length)} (${formatNumber(acceptedInCondition === 0 ? null : milliseconds / acceptedInCondition)} ms/問)`;
      },
    );
    console.log(
      `Lv${id}\t${accepted.length} / ${candidates.length} (${formatNumber(accepted.length / Math.max(1, candidates.length))})\t${formatNumber(accepted.length === 0 ? null : totalMilliseconds / accepted.length)} ms/問\t${byCondition.join("\t")}`,
    );
  }
}

function isInLevelScale(
  record: FlatRecord,
  difficulty: HitofudePuzzleDifficulty,
): boolean {
  return listHitofudePuzzleGenerationConditions(difficulty).some(
    ({ size, targetLookaheadLoad }) =>
      record.size === size &&
      record.targetLookaheadLoad === targetLookaheadLoad,
  );
}

function printSharedScale(records: readonly FlatRecord[]): void {
  console.log("\n## 隣り合うレベルが共有する盤面サイズでの分類の内訳");
  for (const [order, { id: lower }] of difficultyLevels.entries()) {
    const upper = difficultyLevels[order + 1]?.id;
    if (upper === undefined) {
      continue;
    }
    const shared = records.filter(
      (record) =>
        isInLevelScale(record, lower) && isInLevelScale(record, upper),
    );
    const sizes = [...new Set(shared.map((record) => record.size))].join(",");
    const lowerCount = shared.filter((record) => record.level === lower).length;
    const upperCount = shared.filter((record) => record.level === upper).length;
    console.log(
      `Lv${lower}/Lv${upper}\tsize ${sizes}\tLv${lower}=${lowerCount} Lv${upper}=${upperCount} ほか=${shared.length - lowerCount - upperCount}`,
    );
  }
}

function toBoardSize(value: unknown): value is HitofudePuzzleBoardSize {
  return isHitofudePuzzleBoardSize(value);
}

function createTasks(): CorpusTask[] {
  const sizes = readList("sizes", "5,6,7,8", toBoardSize);
  const targets = readList(
    "targets",
    hitofudePuzzleTargetLookaheadLoads.join(","),
    isHitofudePuzzleTargetLookaheadLoad,
  );
  const seedCount = readPositiveInteger("seeds", 100);
  return sizes.flatMap((size) =>
    targets.flatMap((targetLookaheadLoad) =>
      Array.from({ length: seedCount }, (_, index) => ({
        size,
        targetLookaheadLoad,
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
    throw new Error(`Hitofude puzzle corpus worker ${jobIndex} failed`);
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
    left.targetLookaheadLoad - right.targetLookaheadLoad ||
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
  printFeaturesBy("帯ごとの特徴量", flatRecords, "band", bandOrder.slice(0, 5));
  printFeaturesBy(
    "レベルごとの特徴量",
    flatRecords,
    "level",
    difficultyLevels.map(({ id }) => id),
  );
  printLevelScale(flatRecords);
  printRefutationLengths(flatRecords);
  printScaleCorrelations(flatRecords);
  printSupply(flatRecords);
  printSharedScale(flatRecords);
}

const workerIndex = Bun.argv.indexOf("--worker");
if (workerIndex >= 0) {
  runWorker(Number(Bun.argv[workerIndex + 1]));
} else {
  await runMain();
}
