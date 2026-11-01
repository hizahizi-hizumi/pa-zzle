import { writeFileSync } from "node:fs";
import {
  generateTsumeShogiProblem,
  TsumeShogiGenerationExhaustedError,
} from "@/games/tsume-shogi/problem/generator";
import {
  createTsumeShogiProblemIdentity,
  formatTsumeShogiProblemText,
  isTsumeShogiGenerationPlies,
  type TsumeShogiGenerationPlies,
} from "@/games/tsume-shogi/problem/problem";

const usage = `Usage: bun run generate:tsume-shogi-pool -- [options]

手数ごとに、決定的な seed（ts-<手数>-<候補番号>）の候補を番号順に逆算 generator で作り、生成率・時間・重複を集計する。
問題集（problem-pool.json）はまだ書かない。難易度別の選抜と問題集の生成は後続の段で足す。

Options:
  --plies <list>   作る手数をカンマ区切りで (default: 3,5)
  --budget <n>     手数ごとに作る候補数 (default: 100)
  --jobs <n>       並列ワーカー数 (default: 4)
  --details <path> 候補ごとの結果（局面・作意・品質の状態・指紋・時間）を JSONL で書く。
                   scripts/compare-tsume-shogi-oracle.ts の --input にそのまま渡せる`;

type Candidate =
  | {
      plies: TsumeShogiGenerationPlies;
      index: number;
      seed: string;
      milliseconds: number;
      status: "generated";
      sfen: string;
      mainLine: readonly string[];
      issues: readonly string[];
      positionFingerprint: string;
      solutionFingerprint: string;
      motifFingerprint: string;
      baseCount: number;
      validatedCandidateCount: number;
    }
  | {
      plies: TsumeShogiGenerationPlies;
      index: number;
      seed: string;
      milliseconds: number;
      status: "exhausted";
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

function readPliesList(): TsumeShogiGenerationPlies[] {
  return (readOption("plies") ?? "3,5").split(",").map((text) => {
    const plies = Number(text);
    if (!isTsumeShogiGenerationPlies(plies)) {
      throw new RangeError(`--plies must be a list of 1, 3, 5: ${text}`);
    }
    return plies;
  });
}

function evaluateCandidate(
  plies: TsumeShogiGenerationPlies,
  index: number,
): Candidate {
  const identity = createTsumeShogiProblemIdentity(plies, index);
  const startedAt = performance.now();
  try {
    const generated = generateTsumeShogiProblem(identity);
    const text = formatTsumeShogiProblemText(generated.problem);
    return {
      plies,
      index,
      seed: identity.seed,
      milliseconds: performance.now() - startedAt,
      status: "generated",
      sfen: text.sfen,
      mainLine: text.mainLine,
      issues: generated.validation.issues,
      positionFingerprint: generated.fingerprint.position,
      solutionFingerprint: generated.fingerprint.solution,
      motifFingerprint: generated.fingerprint.motif,
      baseCount: generated.baseCount,
      validatedCandidateCount: generated.validatedCandidateCount,
    };
  } catch (error) {
    if (!(error instanceof TsumeShogiGenerationExhaustedError)) {
      throw error;
    }
    return {
      plies,
      index,
      seed: identity.seed,
      milliseconds: performance.now() - startedAt,
      status: "exhausted",
    };
  }
}

function runWorker(args: readonly string[]): void {
  const [plies, start, count] = args.map(Number);
  if (!isTsumeShogiGenerationPlies(plies)) {
    throw new RangeError(`Unsupported plies: ${plies}`);
  }
  for (let index = start!; index < start! + count!; index += 1) {
    console.log(JSON.stringify(evaluateCandidate(plies, index)));
  }
}

type Batch = { plies: TsumeShogiGenerationPlies; start: number; count: number };

/** 1つのワーカーに渡す候補数。生成時間のばらつきが大きいので細かく分ける。 */
const batchSize = 10;

async function runBatch({ plies, start, count }: Batch): Promise<Candidate[]> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      String(plies),
      String(start),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker failed for ${plies} plies from ${start}`);
  }
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Candidate);
}

async function runBatches(
  batches: readonly Batch[],
  jobs: number,
): Promise<Candidate[]> {
  const queue = [...batches];
  const results: Candidate[] = [];
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let batch = queue.shift(); batch; batch = queue.shift()) {
        results.push(...(await runBatch(batch)));
      }
    }),
  );
  return results.sort(
    (left, right) => left.plies - right.plies || left.index - right.index,
  );
}

function quantile(sorted: readonly number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

function describeDistribution(values: readonly number[]): string {
  if (values.length === 0) {
    return "-";
  }
  const sorted = [...values].sort((left, right) => left - right);
  return `p50=${quantile(sorted, 0.5).toFixed(0)} p90=${quantile(sorted, 0.9).toFixed(0)} p99=${quantile(sorted, 0.99).toFixed(0)} max=${sorted.at(-1)!.toFixed(0)}`;
}

function countDistinct(values: readonly string[]): number {
  return new Set(values).size;
}

function formatCounts(values: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .sort(([, left], [, right]) => right - left)
    .map(([value, count]) => `${value}=${count}`)
    .join(" / ");
}

function describePlies(
  plies: TsumeShogiGenerationPlies,
  candidates: readonly Candidate[],
): string[] {
  const generated = candidates.flatMap((candidate) =>
    candidate.status === "generated" ? [candidate] : [],
  );
  const cpuSeconds =
    candidates.reduce((sum, candidate) => sum + candidate.milliseconds, 0) /
    1000;
  const rate = (generated.length / candidates.length) * 100;
  const motifCounts = formatCounts(
    generated.map((candidate) => candidate.motifFingerprint),
  )
    .split(" / ")
    .slice(0, 5)
    .join(" / ");
  return [
    `## ${plies}手: 候補 ${candidates.length}`,
    `  生成 ${generated.length} (${rate.toFixed(1)}%) / 上限まで作れず ${candidates.length - generated.length} / 計算 ${cpuSeconds.toFixed(1)}s (CPU)`,
    `  生成時間 (ms): ${describeDistribution(generated.map((candidate) => candidate.milliseconds))}`,
    `  ユニーク: 局面 ${countDistinct(generated.map((candidate) => candidate.positionFingerprint))} / 作意 ${countDistinct(generated.map((candidate) => candidate.solutionFingerprint))} / 手筋 ${countDistinct(generated.map((candidate) => candidate.motifFingerprint))}`,
    `  変化同手数: ${generated.filter((candidate) => candidate.issues.includes("equalLengthVariation")).length}`,
    `  起点にした1手詰の数: ${formatCounts(generated.map((candidate) => String(candidate.baseCount)))}`,
    `  strict validator にかけた候補の数: ${describeDistribution(generated.map((candidate) => candidate.validatedCandidateCount))}`,
    `  多い手筋: ${motifCounts}`,
  ];
}

async function runMain(): Promise<void> {
  const pliesList = readPliesList();
  const budget = readPositiveInteger("budget", 100);
  const jobs = readPositiveInteger("jobs", 4);
  const startedAt = performance.now();

  const batches = pliesList.flatMap((plies) =>
    Array.from(
      { length: Math.ceil(budget / batchSize) },
      (_, part): Batch => ({
        plies,
        start: part * batchSize,
        count: Math.min(batchSize, budget - part * batchSize),
      }),
    ),
  );
  const candidates = await runBatches(batches, jobs);
  const wallSeconds = (performance.now() - startedAt) / 1000;

  const report = pliesList.flatMap((plies) =>
    describePlies(
      plies,
      candidates.filter((candidate) => candidate.plies === plies),
    ),
  );
  console.log(report.join("\n"));
  console.log(`\n全体: ${wallSeconds.toFixed(1)}s (wall, jobs=${jobs})`);

  const detailsPath = readOption("details");
  if (detailsPath !== undefined) {
    writeFileSync(
      detailsPath,
      `${candidates.map((candidate) => JSON.stringify(candidate)).join("\n")}\n`,
    );
  }
}

if (Bun.argv.includes("--help")) {
  console.log(usage);
} else if (Bun.argv.includes("--worker")) {
  runWorker(Bun.argv.slice(Bun.argv.indexOf("--worker") + 1));
} else {
  await runMain();
}
