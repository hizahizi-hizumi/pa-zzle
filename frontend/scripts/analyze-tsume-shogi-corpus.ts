import { readFileSync, writeFileSync } from "node:fs";
import {
  assessTsumeShogiDifficulty,
  listTsumeShogiGenerationConditions,
  type TsumeShogiDifficultyAssessment,
  tsumeShogiDifficulties,
} from "@/games/tsume-shogi/difficulty";
import {
  analyzeTsumeShogiDifficulty,
  type TsumeShogiDifficultyAnalysis,
  type TsumeShogiDifficultyFeatures,
  tsumeShogiTesujiKinds,
} from "@/games/tsume-shogi/problem/difficulty-analysis";
import { createTsumeShogiProblemFingerprint } from "@/games/tsume-shogi/problem/generation/fingerprint";
import {
  generateTsumeShogiProblem,
  TsumeShogiGenerationExhaustedError,
} from "@/games/tsume-shogi/problem/generator";
import {
  createTsumeShogiProblemIdentity,
  formatTsumeShogiProblemText,
  isTsumeShogiGenerationPlies,
  parseTsumeShogiProblemText,
  type TsumeShogiGenerationConditions,
  type TsumeShogiProblem,
} from "@/games/tsume-shogi/problem/problem";

const usage = `Usage: bun run analyze:tsume-shogi -- --output <path-prefix> [options]

生成条件ごとに決定的な seed の候補を逆算 generator で作り、難易度を分析・分類して、特徴の分布・レベルごとの供給・
手数への依存を集計する。--input を渡すと生成せず、その JSONL の局面を分析する。

Options:
  --conditions <spec>    生成条件をセミコロン区切りで。<手数>（絞らない）か <手数>:<下限>-<上限>（初手の王手の数）。
                         例: "3;5;5:10-99" (default: 3・5の絞らない条件と、各レベルの生成条件)
  --seeds <n>            条件ごとの seed 数 (default: 40)
  --jobs <n>             並列ワーカー数 (default: 4)
  --input <path>         生成スクリプトの --details の JSONL（sfen・mainLine・seed を持つ行）を分析する
  --output <path-prefix> <path-prefix>.jsonl と <path-prefix>.csv へ出力する`;

type CorpusTask =
  | {
      kind: "generate";
      conditions: TsumeShogiGenerationConditions;
      index: number;
    }
  | { kind: "input"; seed: string; sfen: string; mainLine: string[] };

type CorpusRecord = {
  seed: string;
  condition: string;
  plies: number | null;
  generationMilliseconds: number | null;
  analysisMilliseconds: number | null;
  sfen: string | null;
  mainLine: string[] | null;
  motifFingerprint: string | null;
  analysis: TsumeShogiDifficultyAnalysis | null;
  assessment: TsumeShogiDifficultyAssessment | { status: "exhausted" };
};

/** 難易度PoC（詰将棋難易度PoC §8 の5手詰ミニプール）のレベルごとの中央値。比較のために並べる。 */
const proofOfConceptMedians = {
  "1": { rootChecks: 1, deepDecoyCount: 0 },
  "2": { rootChecks: 2, deepDecoyCount: 0 },
  "3": { rootChecks: 4, deepDecoyCount: 3 },
  "4": { rootChecks: 6, deepDecoyCount: 4 },
  "5": { rootChecks: 9, deepDecoyCount: 7 },
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

function formatCondition({
  plies,
  rootChecks,
}: TsumeShogiGenerationConditions): string {
  return rootChecks === undefined
    ? String(plies)
    : `${plies}:${rootChecks.minimum}-${rootChecks.maximum}`;
}

function parseCondition(text: string): TsumeShogiGenerationConditions {
  const match = text.trim().match(/^(\d+)(?::(\d+)-(\d+))?$/);
  const plies = Number(match?.[1]);
  if (!match || !isTsumeShogiGenerationPlies(plies)) {
    throw new RangeError(`Invalid --conditions entry: ${text}`);
  }
  return match[2] === undefined
    ? { plies }
    : {
        plies,
        rootChecks: { minimum: Number(match[2]), maximum: Number(match[3]) },
      };
}

function listDefaultConditions(): TsumeShogiGenerationConditions[] {
  const conditions: TsumeShogiGenerationConditions[] = [
    { plies: 3 },
    { plies: 5 },
    ...tsumeShogiDifficulties.flatMap(({ id }) =>
      listTsumeShogiGenerationConditions(id),
    ),
  ];
  return [
    ...new Map(
      conditions.map((condition) => [formatCondition(condition), condition]),
    ).values(),
  ];
}

function createTasks(): CorpusTask[] {
  const inputPath = readOption("input");
  if (inputPath !== undefined) {
    return readFileSync(inputPath, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line))
      .filter((row) => typeof row.sfen === "string" && row.plies !== 1)
      .map((row) => ({
        kind: "input",
        seed: String(row.seed ?? row.sfen),
        sfen: row.sfen,
        mainLine: row.mainLine,
      }));
  }
  const conditionSpec = readOption("conditions");
  const conditions =
    conditionSpec === undefined
      ? listDefaultConditions()
      : conditionSpec.split(";").map(parseCondition);
  const seeds = readPositiveInteger("seeds", 40);
  return conditions.flatMap((condition) =>
    Array.from({ length: seeds }, (_, index) => ({
      kind: "generate" as const,
      conditions: condition,
      index,
    })),
  );
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 10) / 10;
}

function analyzeProblem(
  problem: TsumeShogiProblem,
): Pick<CorpusRecord, "analysis" | "assessment" | "analysisMilliseconds"> {
  const startedAt = performance.now();
  const analysis = analyzeTsumeShogiDifficulty(problem);
  return {
    analysis,
    assessment: assessTsumeShogiDifficulty(analysis),
    analysisMilliseconds: roundMilliseconds(performance.now() - startedAt),
  };
}

function runTask(task: CorpusTask): CorpusRecord {
  if (task.kind === "input") {
    const problem = parseTsumeShogiProblemText(task);
    return {
      seed: task.seed,
      condition: `input:${problem.plies}`,
      plies: problem.plies,
      generationMilliseconds: null,
      sfen: task.sfen,
      mainLine: task.mainLine,
      motifFingerprint: createTsumeShogiProblemFingerprint(problem).motif,
      ...analyzeProblem(problem),
    };
  }
  const { plies, rootChecks } = task.conditions;
  const identity = createTsumeShogiProblemIdentity(
    plies,
    task.index,
    rootChecks,
  );
  const startedAt = performance.now();
  try {
    const generated = generateTsumeShogiProblem(identity);
    const generationMilliseconds = roundMilliseconds(
      performance.now() - startedAt,
    );
    const text = formatTsumeShogiProblemText(generated.problem);
    return {
      seed: identity.seed,
      condition: formatCondition(task.conditions),
      plies,
      generationMilliseconds,
      sfen: text.sfen,
      mainLine: [...text.mainLine],
      motifFingerprint: generated.fingerprint.motif,
      ...analyzeProblem(generated.problem),
    };
  } catch (error) {
    if (!(error instanceof TsumeShogiGenerationExhaustedError)) {
      throw error;
    }
    return {
      seed: identity.seed,
      condition: formatCondition(task.conditions),
      plies,
      generationMilliseconds: roundMilliseconds(performance.now() - startedAt),
      analysisMilliseconds: null,
      sfen: null,
      mainLine: null,
      motifFingerprint: null,
      analysis: null,
      assessment: { status: "exhausted" },
    };
  }
}

function featuresOf(record: CorpusRecord): TsumeShogiDifficultyFeatures | null {
  return record.analysis?.status === "analyzed"
    ? record.analysis.features
    : null;
}

function outcomeOf(record: CorpusRecord): string {
  const { assessment } = record;
  switch (assessment.status) {
    case "classified":
      return `L${assessment.difficulty}`;
    case "out-of-range":
      return `out-of-range:${assessment.reason}`;
    default:
      return assessment.status;
  }
}

type FlatRecord = Record<string, string | number | null>;

function flattenRecord(record: CorpusRecord): FlatRecord {
  const features = featuresOf(record);
  return {
    seed: record.seed,
    condition: record.condition,
    plies: record.plies,
    outcome: outcomeOf(record),
    rootChecks: features?.rootChecks ?? null,
    plausibleWrong: features?.plausibleWrong ?? null,
    deepDecoyCount: features?.deepDecoyCount ?? null,
    defenseBranching: features?.defenseBranching ?? null,
    tesujiKindCount: features?.tesujiKindCount ?? null,
    ...Object.fromEntries(
      tsumeShogiTesujiKinds.map((kind) => [
        kind,
        features?.motifs[kind] ?? null,
      ]),
    ),
    drop: features?.motifs.drop ?? null,
    motif: record.motifFingerprint,
    generationMilliseconds: record.generationMilliseconds,
    analysisMilliseconds: record.analysisMilliseconds,
    sfen: record.sfen,
    mainLine: record.mainLine?.join(" ") ?? null,
  };
}

function toCsv(rows: readonly FlatRecord[]): string {
  const columns = Object.keys(rows[0] ?? {});
  function escapeCsv(value: string | number | null): string {
    const text = value === null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }
  return `${[columns.join(","), ...rows.map((row) => columns.map((column) => escapeCsv(row[column] ?? null)).join(","))].join("\n")}\n`;
}

function quantile(sorted: readonly number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function describeDistribution(values: readonly number[]): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  return `p50=${quantile(sorted, 0.5).toFixed(0)} p90=${quantile(sorted, 0.9).toFixed(0)} p99=${quantile(sorted, 0.99).toFixed(0)} max=${sorted.at(-1)!.toFixed(0)}`;
}

function formatCounts(values: readonly (string | number)[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true }),
    )
    .map(([value, count]) => `${value}=${count}`)
    .join(" ");
}

function printConditionSummary(records: readonly CorpusRecord[]): void {
  console.log("## 生成条件ごとの分類");
  const conditions = [...new Set(records.map((record) => record.condition))];
  for (const condition of conditions) {
    const group = records.filter((record) => record.condition === condition);
    const generated = group.filter(
      (record) => record.assessment.status !== "exhausted",
    );
    console.log(
      `- ${condition}: 候補 ${group.length} / 作れず ${group.length - generated.length} / ${formatCounts(generated.map(outcomeOf))}`,
    );
    console.log(
      `  生成 (ms): ${describeDistribution(group.flatMap((record) => record.generationMilliseconds ?? []))} / 分析 (ms): ${describeDistribution(generated.flatMap((record) => record.analysisMilliseconds ?? []))}`,
    );
  }
}

const featureNames = [
  "rootChecks",
  "plausibleWrong",
  "deepDecoyCount",
  "defenseBranching",
  "tesujiKindCount",
] as const;

function printLevelFeatures(records: readonly CorpusRecord[]): void {
  console.log(
    "\n## レベルごとの特徴（中央値 [最小〜最大]）と難易度PoCとの比較",
  );
  for (const { id } of tsumeShogiDifficulties) {
    const group = records.filter(
      (record) =>
        record.assessment.status === "classified" &&
        record.assessment.difficulty === id,
    );
    const features = group.flatMap((record) => featuresOf(record) ?? []);
    const columns = featureNames.map((name) => {
      const values = features.map((feature) => feature[name]);
      return `${name} ${median(values) ?? "-"} [${values.length ? Math.min(...values) : "-"}〜${values.length ? Math.max(...values) : "-"}]`;
    });
    const poc = proofOfConceptMedians[id];
    console.log(
      `- L${id}: ${group.length}問 / 手数 ${formatCounts(group.map((record) => record.plies ?? "-"))} / 手筋の列 ${new Set(group.map((record) => record.motifFingerprint)).size}種`,
    );
    console.log(`  ${columns.join(" / ")}`);
    console.log(
      `  PoC: rootChecks ${poc.rootChecks} / deepDecoyCount ${poc.deepDecoyCount}`,
    );
    console.log(
      `  作意に現れた手筋（問題数）: ${tsumeShogiTesujiKinds.map((kind) => `${kind}=${features.filter((feature) => feature.motifs[kind] > 0).length}`).join(" ")}`,
    );
  }
}

function printPliesDependence(records: readonly CorpusRecord[]): void {
  console.log("\n## 手数ごとの分類（手数だけでレベルが決まっていないか）");
  for (const plies of [3, 5]) {
    const group = records.filter(
      (record) =>
        record.plies === plies && record.assessment.status !== "exhausted",
    );
    console.log(
      `- ${plies}手: ${group.length}問 / ${formatCounts(group.map(outcomeOf))}`,
    );
  }
}

function printFeatureDistributions(records: readonly CorpusRecord[]): void {
  console.log("\n## 分析できた候補の特徴の分布（手数別）");
  for (const plies of [3, 5]) {
    const features = records
      .filter((record) => record.plies === plies)
      .flatMap((record) => featuresOf(record) ?? []);
    console.log(`- ${plies}手: ${features.length}問`);
    for (const name of featureNames) {
      console.log(
        `  ${name}: ${formatCounts(features.map((feature) => Math.min(feature[name], 20)))}`,
      );
    }
  }
}

function sliceJobTasks(
  tasks: readonly CorpusTask[],
  jobIndex: number,
  jobCount: number,
): CorpusTask[] {
  return tasks.filter((_, index) => index % jobCount === jobIndex);
}

function runWorker(jobIndex: number, jobCount: number): void {
  for (const task of sliceJobTasks(createTasks(), jobIndex, jobCount)) {
    console.log(JSON.stringify(runTask(task)));
  }
}

async function runJobInWorker(
  jobIndex: number,
  jobCount: number,
): Promise<CorpusRecord[]> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      ...Bun.argv.slice(2),
      "--worker",
      String(jobIndex),
      String(jobCount),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker ${jobIndex} failed`);
  }
  return output
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CorpusRecord);
}

async function runMain(): Promise<void> {
  const outputPrefix = readOption("output");
  if (outputPrefix === undefined) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }
  const jobs = readPositiveInteger("jobs", 4);
  const startedAt = performance.now();
  const records = (
    await Promise.all(
      Array.from({ length: jobs }, (_, jobIndex) =>
        runJobInWorker(jobIndex, jobs),
      ),
    )
  )
    .flat()
    .sort(
      (left, right) =>
        left.condition.localeCompare(right.condition) ||
        left.seed.localeCompare(right.seed, undefined, { numeric: true }),
    );

  writeFileSync(
    `${outputPrefix}.jsonl`,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
  writeFileSync(`${outputPrefix}.csv`, toCsv(records.map(flattenRecord)));

  printConditionSummary(records);
  printLevelFeatures(records);
  printPliesDependence(records);
  printFeatureDistributions(records);
  console.log(
    `\n全体: ${records.length}候補 ${((performance.now() - startedAt) / 1000).toFixed(1)}s (wall, jobs=${jobs})`,
  );
}

const workerIndex = Bun.argv.indexOf("--worker");
if (Bun.argv.includes("--help")) {
  console.log(usage);
} else if (workerIndex >= 0) {
  runWorker(
    Number(Bun.argv[workerIndex + 1]),
    Number(Bun.argv[workerIndex + 2]),
  );
} else {
  await runMain();
}
