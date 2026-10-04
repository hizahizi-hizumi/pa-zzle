import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import {
  assessTsumeShogiDifficulty,
  isTsumeShogiSupplementalGenerationConditions,
  listTsumeShogiGenerationConditions,
  type TsumeShogiDifficulty,
  tsumeShogiDifficulties,
} from "@/games/tsume-shogi/difficulty";
import {
  analyzeTsumeShogiDifficulty,
  type TsumeShogiDifficultyFeatures,
} from "@/games/tsume-shogi/problem/difficulty-analysis";
import {
  createTsumeShogiProblemFingerprint,
  type TsumeShogiProblemFingerprint,
} from "@/games/tsume-shogi/problem/generation/fingerprint";
import {
  generateTsumeShogiProblem,
  TsumeShogiGenerationExhaustedError,
} from "@/games/tsume-shogi/problem/generator";
import {
  createTsumeShogiProblemIdentity,
  formatTsumeShogiGenerationConditionsText,
  formatTsumeShogiProblemText,
  parseTsumeShogiGenerationConditionsText,
  TSUME_SHOGI_GENERATOR_VERSION,
  type TsumeShogiProblem,
} from "@/games/tsume-shogi/problem/problem";
import {
  formatTsumeShogiPoolPosition,
  formatTsumeShogiPoolProblemId,
  listTsumeShogiPoolEntries,
  type TsumeShogiProblemPoolEntry,
  toTsumeShogiPooledProblem,
} from "@/games/tsume-shogi/problem/problem-pool";
import { selectTsumeShogiProblemForDifficulty } from "@/games/tsume-shogi/problem-selection";

/**
 * レベルごとの問題数。同じレベルの中では玉から見た攻方の手順（`attack` の指紋）が重ならない問題だけを採るので、
 * 問題数はレベルごとに手順の重ならない候補を集められる数で決める。レベル1 は3手詰で初手の王手が少なく、
 * 手順の種類そのものが少ない。レベル5 は5手詰で初手の王手が多い候補しか当たらず、1候補の生成に数秒〜1分かかる。
 */
const defaultPerLevel = {
  "1": 500,
  "2": 1000,
  "3": 1000,
  "4": 1000,
  "5": 500,
} as const satisfies Record<TsumeShogiDifficulty, number>;

/**
 * 問題集の版。問題の並び（問題番号 `<レベル>-<番号>` が指す問題）が変わる作り直しをしたら上げる。
 * 生成器の版（`TSUME_SHOGI_GENERATOR_VERSION`）が上がったときも並びは変わるので上げる。
 */
const poolVersion = "1";

/**
 * 1つのレベルの中で、同じ手筋の列（`motif` の指紋）の問題が占めてよい割合の上限。逆算で作りやすい筋に偏らないようにする。
 */
const MOTIF_SHARE_LIMIT = 0.1;

/** 1つのレベルの中で、初手の捨駒を玉で取らせる筋（逆算で作りやすい）が占めてよい割合の上限。 */
const SACRIFICE_KING_CAPTURE_SHARE_LIMIT = 0.5;

/**
 * 1つのレベルの中で、最終手が駒打ちの問題が占めてよい割合の上限。逆算の起点の1手詰の多くが駒打ちなので上限を置く。
 * レベル1 は起点を限らない候補のほぼすべてが最終手の駒打ちなので、盤上の駒を動かす1手詰を起点にした候補を足し、
 * 駒打ちと盤上の駒の移動が半々になるまで寄せる。
 */
const finalDropShareLimits = {
  "1": 0.5,
  "2": 0.85,
  "3": 0.85,
  "4": 0.85,
  "5": 0.85,
} as const satisfies Record<TsumeShogiDifficulty, number>;

const usage = `Usage: bun run generate:tsume-shogi-pool -- --cache <path> [options]

レベルごとの生成条件（listTsumeShogiGenerationConditions）で決定的な seed の候補を番号順に生成・分析・分類し、
候補を --cache の JSONL に貯める。各レベルに分類された候補が「問題数 × --surplus」に届き、重複と偏りの上限を除いても
問題数に届くまで増やしてから、
局面と作意の指紋の重複と、同じレベルの中での攻方の手順の指紋の重複を除き、手筋の偏りの上限を守って、
生成条件を巡回して問題集へ採る。

外部 oracle の照合はこのスクリプトでは行わない（CI・製品に入れないため）。ローカルで照合するときは、
1. --oracle-input で分類できた候補の局面を書き出し、
2. scripts/compare-tsume-shogi-oracle.ts --input <その JSONL> --results <結果の JSONL> で照合し、
3. --oracle-results <結果の JSONL> を付けて問題集を作り直す（照合結果の無い候補・「不一致」「長い変化」・時間切れの候補を採らない）。

Options:
  --cache <path>           候補の JSONL（必須）。あれば読み、足りない候補だけを生成して追記する
  --per-level <n>          全レベル共通の問題数 (default: レベル1〜5で ${Object.values(defaultPerLevel).join(" / ")})
  --surplus <ratio>        各レベルに分類された候補を、問題数のこの倍まで集める。重複と偏りの上限を除いて問題数に
                           届かないレベルは、さらに増やす (default: 1.3)
  --jobs <n>               並列ワーカー数 (default: 4)
  --block <n>              生成条件ごとに一度に増やす候補数 (default: 40)
  --budget <n>             生成条件ごとに調べる候補数の上限 (default: 6000)
  --oracle-input <path>    分類できた候補の {"sfen", "plies"} を JSONL で書く（oracle 照合の入力）
  --oracle-results <path>  compare-tsume-shogi-oracle.ts --results の JSONL。照合で問題の無い候補だけを採る
  --details <path>         採った問題ごとの seed・特徴・指紋を JSONL で書く
  --verify                 生成せず、同梱の問題集の全問を再生成→分析→分類し、重複（レベルの中の攻方の手順を含む）・
                           偏りの上限・JSON の大きさ・選択時間を確かめる`;

const outputPath = new URL(
  "../src/games/tsume-shogi/problem/problem-pool.json",
  import.meta.url,
);

type CandidateFeatures = Pick<
  TsumeShogiDifficultyFeatures,
  | "rootChecks"
  | "plausibleWrong"
  | "deepDecoyCount"
  | "defenseBranching"
  | "tesujiKindCount"
>;

type Candidate = {
  condition: string;
  index: number;
  seed: string;
  milliseconds: number;
  /** 分類の結果。`exhausted` は生成器が上限までに作れなかった。 */
  outcome:
    | "classified"
    | "out-of-range"
    | "unsupported"
    | "invalid"
    | "exhausted";
  difficulty: TsumeShogiDifficulty | null;
  plies: number;
  sfen: string | null;
  entry: TsumeShogiProblemPoolEntry | null;
  fingerprint: TsumeShogiProblemFingerprint | null;
  features: CandidateFeatures | null;
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

function readPositiveNumber(name: string, fallback: number): number {
  const value = Number(readOption(name) ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`--${name} must be a positive number`);
  }
  return value;
}

/** 全レベルの生成条件を、レベル1の条件から順に重複なく並べる。この順が問題集で採る順の一部になる。 */
function listAllConditions(): string[] {
  return [
    ...new Set(
      tsumeShogiDifficulties.flatMap(({ id }) =>
        listTsumeShogiGenerationConditions(id).map(
          formatTsumeShogiGenerationConditionsText,
        ),
      ),
    ),
  ];
}

/** 作意の最終手が駒打ちか。 */
function endsWithDrop([, , mainLine]: TsumeShogiProblemPoolEntry): boolean {
  return mainLine.split(" ").at(-1)!.includes("*");
}

/**
 * 初期局面の玉の場所。`corner` は1段目の1筋・9筋、`edge` はそれ以外の1段目か1筋・9筋、`middle` はそれ以外。
 * 問題集の偏りを見るために使う。
 */
function describeInitialKingPlace([, position]: TsumeShogiProblemPoolEntry):
  | "corner"
  | "edge"
  | "middle" {
  const ranks = position.split(" ")[0]!.split("/");
  const rank = ranks.findIndex((row) => row.includes("k")) + 1;
  let file = 10;
  for (const character of ranks[rank - 1]!.replaceAll("+", "")) {
    file -= /\d/.test(character) ? Number(character) : 1;
    if (character === "k") {
      break;
    }
  }
  const onSideFile = file === 1 || file === 9;
  if (rank === 1 && onSideFile) {
    return "corner";
  }
  return rank === 1 || onSideFile ? "edge" : "middle";
}

/** 初手が捨駒（次の玉方の手で取られる）で、それを玉が取る筋か。 */
function startsWithSacrificeKingCapture({
  motif,
}: TsumeShogiProblemFingerprint): boolean {
  const [first, second] = motif.split(" ");
  return first!.includes("捨") && second === "玉取";
}

function summarizeFeatures(
  features: TsumeShogiDifficultyFeatures,
): CandidateFeatures {
  const {
    rootChecks,
    plausibleWrong,
    deepDecoyCount,
    defenseBranching,
    tesujiKindCount,
  } = features;
  return {
    rootChecks,
    plausibleWrong,
    deepDecoyCount,
    defenseBranching,
    tesujiKindCount,
  };
}

function toPoolEntry(
  seed: string,
  problem: TsumeShogiProblem,
): TsumeShogiProblemPoolEntry {
  return [
    seed,
    formatTsumeShogiPoolPosition(problem.initialPosition),
    formatTsumeShogiProblemText(problem).mainLine.join(" "),
  ];
}

function evaluateCandidate(condition: string, index: number): Candidate {
  const conditions = parseTsumeShogiGenerationConditionsText(condition);
  const identity = createTsumeShogiProblemIdentity(
    conditions.plies,
    index,
    conditions.rootChecks,
    conditions.baseMate,
    conditions.baseKingArea,
  );
  const startedAt = performance.now();
  const base = {
    condition,
    index,
    seed: identity.seed,
    plies: conditions.plies,
  };
  try {
    const { problem, fingerprint } = generateTsumeShogiProblem(identity);
    const analysis = analyzeTsumeShogiDifficulty(problem);
    const assessment = assessTsumeShogiDifficulty(analysis);
    return {
      ...base,
      milliseconds: performance.now() - startedAt,
      outcome: assessment.status,
      difficulty:
        assessment.status === "classified" ? assessment.difficulty : null,
      sfen: formatTsumeShogiProblemText(problem).sfen,
      entry: toPoolEntry(identity.seed, problem),
      fingerprint,
      features:
        analysis.status === "analyzed"
          ? summarizeFeatures(analysis.features)
          : null,
    };
  } catch (error) {
    if (!(error instanceof TsumeShogiGenerationExhaustedError)) {
      throw error;
    }
    return {
      ...base,
      milliseconds: performance.now() - startedAt,
      outcome: "exhausted",
      difficulty: null,
      sfen: null,
      entry: null,
      fingerprint: null,
      features: null,
    };
  }
}

function runWorker(args: readonly string[]): void {
  const [condition, start, count] = args;
  for (
    let index = Number(start);
    index < Number(start) + Number(count);
    index += 1
  ) {
    console.log(JSON.stringify(evaluateCandidate(condition!, index)));
  }
}

type Batch = { condition: string; start: number; count: number };

/** 1つのワーカーに渡す候補数。5手詰は1候補の時間のばらつきが大きいので細かく分ける。 */
const batchSize = 10;

async function runBatch({
  condition,
  start,
  count,
}: Batch): Promise<Candidate[]> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      condition,
      String(start),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker failed for ${condition} from ${start}`);
  }
  return output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Candidate);
}

/** 候補を生成条件ごとに番号順で持つ。番号は 0 から連続して埋まる。 */
type CandidateStore = Map<string, Candidate[]>;

function readCache(path: string): CandidateStore {
  const store: CandidateStore = new Map(
    listAllConditions().map((condition) => [condition, []]),
  );
  if (!existsSync(path)) {
    return store;
  }
  const byCondition = new Map<string, Map<number, Candidate>>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    const candidate = JSON.parse(line) as Candidate;
    const indexed = byCondition.get(candidate.condition) ?? new Map();
    indexed.set(candidate.index, candidate);
    byCondition.set(candidate.condition, indexed);
  }
  for (const [condition, candidates] of store) {
    const indexed = byCondition.get(condition);
    for (let index = 0; indexed?.has(index); index += 1) {
      candidates.push(indexed.get(index)!);
    }
  }
  return store;
}

async function extendCandidates(
  store: CandidateStore,
  requiredLengths: ReadonlyMap<string, number>,
  jobs: number,
  cachePath: string,
): Promise<void> {
  const queue: Batch[] = [];
  for (const [condition, length] of requiredLengths) {
    const candidates = store.get(condition)!;
    for (let start = candidates.length; start < length; start += batchSize) {
      queue.push({
        condition,
        start,
        count: Math.min(batchSize, length - start),
      });
    }
  }
  const results: Candidate[] = [];
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let batch = queue.shift(); batch; batch = queue.shift()) {
        const generated = await runBatch(batch);
        results.push(...generated);
        writeFileSync(
          cachePath,
          generated
            .map((candidate) => `${JSON.stringify(candidate)}\n`)
            .join(""),
          { flag: "a" },
        );
      }
    }),
  );
  results.sort((left, right) => left.index - right.index);
  for (const candidate of results) {
    store.get(candidate.condition)!.push(candidate);
  }
}

function countClassified(
  store: CandidateStore,
  difficulty: TsumeShogiDifficulty,
): number {
  let count = 0;
  for (const candidates of store.values()) {
    count += candidates.filter(
      (candidate) => candidate.difficulty === difficulty,
    ).length;
  }
  return count;
}

/** 照合の結果のうち、問題集に採ってよいもの。不一致・長い変化・時間切れは採らない。 */
function isAcceptableOracleComparison(comparison: string): boolean {
  return (
    comparison.startsWith("一致") ||
    comparison === "解釈差: oracle が駒余りとした参考手順"
  );
}

function readOracleResults(path: string): Map<string, string> {
  return new Map(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const { sfen, comparison } = JSON.parse(line) as {
          sfen: string;
          comparison: string;
        };
        return [sfen, comparison] as const;
      }),
  );
}

type SkipReason =
  | "oracle"
  | "position"
  | "solution"
  | "attack"
  | "motif"
  | "sacrifice-king-capture"
  | "final-drop";

type LevelSelection = {
  selected: Candidate[];
  classifiedCount: number;
  skipped: Map<SkipReason, number>;
};

function limitOf(perLevel: number, share: number): number {
  return Math.ceil(perLevel * share);
}

/**
 * 1つのレベルに分類された候補を、候補番号の順（同じ番号は生成条件の順）に1つずつ見て採る。起点を絞った生成条件の
 * 候補は、その条件を挙げたレベルにだけ採る（ほかのレベルの候補の並びを変えないため）。局面・作意の指紋が
 * 先に採った問題（下のレベルを含む）と同じ候補、攻方の手順の指紋が同じレベルで先に採った問題と同じ候補（同じレベルを
 * 続けて遊んだときに、玉への迫り方が同じ問題に当たらないようにする）、手筋の列・捨駒を玉で取らせる筋・最終手の駒打ちの
 * 上限を超える候補は飛ばす。
 * 採る問題は候補の JSONL の中身だけで決まり、ワーカー数や生成の順に依存しない。
 */
function selectLevel(
  difficulty: TsumeShogiDifficulty,
  store: CandidateStore,
  perLevel: number,
  seenPositions: Set<string>,
  seenSolutions: Set<string>,
  oracleResults: ReadonlyMap<string, string> | null,
): LevelSelection {
  const conditionOrder = listAllConditions();
  const levelConditions = new Set(
    listTsumeShogiGenerationConditions(difficulty).map(
      formatTsumeShogiGenerationConditionsText,
    ),
  );
  const candidates = [...store.values()]
    .flat()
    .filter(
      (candidate) =>
        candidate.difficulty === difficulty &&
        (levelConditions.has(candidate.condition) ||
          !isTsumeShogiSupplementalGenerationConditions(
            parseTsumeShogiGenerationConditionsText(candidate.condition),
          )),
    )
    .sort(
      (left, right) =>
        left.index - right.index ||
        conditionOrder.indexOf(left.condition) -
          conditionOrder.indexOf(right.condition),
    );
  const seenAttacks = new Set<string>();
  const motifCounts = new Map<string, number>();
  let sacrificeKingCaptureCount = 0;
  let finalDropCount = 0;
  const skipped = new Map<SkipReason, number>();
  const selected: Candidate[] = [];
  function skip(reason: SkipReason): void {
    skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  }
  for (const candidate of candidates) {
    if (selected.length >= perLevel) {
      break;
    }
    const fingerprint = candidate.fingerprint!;
    const entry = candidate.entry!;
    const oracleComparison = oracleResults?.get(candidate.sfen!);
    if (
      oracleResults !== null &&
      (oracleComparison === undefined ||
        !isAcceptableOracleComparison(oracleComparison))
    ) {
      skip("oracle");
      continue;
    }
    if (seenPositions.has(fingerprint.position)) {
      skip("position");
      continue;
    }
    if (seenSolutions.has(fingerprint.solution)) {
      skip("solution");
      continue;
    }
    if (seenAttacks.has(fingerprint.attack)) {
      skip("attack");
      continue;
    }
    if (
      (motifCounts.get(fingerprint.motif) ?? 0) >=
      limitOf(perLevel, MOTIF_SHARE_LIMIT)
    ) {
      skip("motif");
      continue;
    }
    const sacrificeKingCapture = startsWithSacrificeKingCapture(fingerprint);
    if (
      sacrificeKingCapture &&
      sacrificeKingCaptureCount >=
        limitOf(perLevel, SACRIFICE_KING_CAPTURE_SHARE_LIMIT)
    ) {
      skip("sacrifice-king-capture");
      continue;
    }
    const finalDrop = endsWithDrop(entry);
    if (
      finalDrop &&
      finalDropCount >= limitOf(perLevel, finalDropShareLimits[difficulty])
    ) {
      skip("final-drop");
      continue;
    }
    seenPositions.add(fingerprint.position);
    seenSolutions.add(fingerprint.solution);
    seenAttacks.add(fingerprint.attack);
    motifCounts.set(
      fingerprint.motif,
      (motifCounts.get(fingerprint.motif) ?? 0) + 1,
    );
    sacrificeKingCaptureCount += sacrificeKingCapture ? 1 : 0;
    finalDropCount += finalDrop ? 1 : 0;
    selected.push(candidate);
  }
  return { selected, classifiedCount: candidates.length, skipped };
}

/** レベル1から順に問題集へ採る。局面・作意の指紋の重複は、下のレベルで採った問題とも比べる。 */
function selectAllLevels(
  store: CandidateStore,
  perLevelOf: (difficulty: TsumeShogiDifficulty) => number,
  oracleResults: ReadonlyMap<string, string> | null,
): Map<TsumeShogiDifficulty, LevelSelection> {
  const seenPositions = new Set<string>();
  const seenSolutions = new Set<string>();
  return new Map(
    tsumeShogiDifficulties.map(({ id: difficulty }) => [
      difficulty,
      selectLevel(
        difficulty,
        store,
        perLevelOf(difficulty),
        seenPositions,
        seenSolutions,
        oracleResults,
      ),
    ]),
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
  return `min=${sorted[0]!.toFixed(0)} p25=${quantile(sorted, 0.25).toFixed(0)} median=${quantile(sorted, 0.5).toFixed(0)} p75=${quantile(sorted, 0.75).toFixed(0)} max=${sorted.at(-1)!.toFixed(0)}`;
}

function formatCounts(values: readonly (string | number)[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) =>
      left.localeCompare(right, "en", { numeric: true }),
    )
    .map(([value, count]) => `${value}=${count}`)
    .join(" ");
}

function formatPoolJson(
  levels: Record<TsumeShogiDifficulty, readonly TsumeShogiProblemPoolEntry[]>,
): string {
  const lines = tsumeShogiDifficulties.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map((entry) => `      ${JSON.stringify(entry)}`)
        .join(
          ",\n",
        )}\n    ]${levelIndex < tsumeShogiDifficulties.length - 1 ? "," : ""}`,
  );
  return `{\n  "poolVersion": ${JSON.stringify(poolVersion)},\n  "generatorVersion": ${JSON.stringify(TSUME_SHOGI_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`;
}

function describeSize(json: string): string {
  return `JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`;
}

type LevelSummarySource = {
  entry: TsumeShogiProblemPoolEntry;
  fingerprint: TsumeShogiProblemFingerprint;
  features: CandidateFeatures;
};

/** 問題集の1レベルの内訳（手数、特徴、手筋の偏り）。 */
function describeLevelEntries(
  sources: readonly LevelSummarySource[],
): string[] {
  const count = sources.length;
  function share(predicate: (source: LevelSummarySource) => boolean): string {
    const matched = sources.filter(predicate).length;
    return `${matched} (${((matched / count) * 100).toFixed(0)}%)`;
  }
  const motifCounts = new Map<string, number>();
  for (const { fingerprint } of sources) {
    motifCounts.set(
      fingerprint.motif,
      (motifCounts.get(fingerprint.motif) ?? 0) + 1,
    );
  }
  const [mostFrequentMotif] = [...motifCounts].sort(
    ([, left], [, right]) => right - left,
  );
  return [
    `  手数: ${formatCounts(sources.map(({ entry }) => entry[2].split(" ").length))}`,
    ...(
      [
        "rootChecks",
        "plausibleWrong",
        "deepDecoyCount",
        "defenseBranching",
        "tesujiKindCount",
      ] as const
    ).map(
      (name) =>
        `  ${name}: ${describeDistribution(sources.map(({ features }) => features[name]))}`,
    ),
    `  手筋の列: ${new Set(sources.map(({ fingerprint }) => fingerprint.motif)).size}種 / 最多 ${mostFrequentMotif ? `「${mostFrequentMotif[0]}」${mostFrequentMotif[1]}問` : "-"}`,
    `  攻方の手順: ${new Set(sources.map(({ fingerprint }) => fingerprint.attack)).size}種`,
    `  最終手が駒打ち: ${share(({ entry }) => endsWithDrop(entry))} / 初手の捨駒を玉で取らせる: ${share(({ fingerprint }) => startsWithSacrificeKingCapture(fingerprint))}`,
    `  初期局面の玉: 隅 ${share(({ entry }) => describeInitialKingPlace(entry) === "corner")} / 端 ${share(({ entry }) => describeInitialKingPlace(entry) === "edge")} / 盤の中 ${share(({ entry }) => describeInitialKingPlace(entry) === "middle")}`,
  ];
}

function writeOracleInput(path: string, store: CandidateStore): void {
  const lines = [...store.values()]
    .flat()
    .filter((candidate) => candidate.difficulty !== null)
    .map((candidate) =>
      JSON.stringify({ sfen: candidate.sfen, plies: candidate.plies }),
    );
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function describeOracle(
  selected: readonly Candidate[],
  oracleResults: ReadonlyMap<string, string> | null,
): string {
  if (oracleResults === null) {
    return "  oracle 照合: 未実施（--oracle-results なし）";
  }
  return `  oracle 照合: ${formatCounts(selected.map((candidate) => oracleResults.get(candidate.sfen!)!))}`;
}

async function runMain(): Promise<void> {
  const cachePath = readOption("cache");
  if (cachePath === undefined) {
    console.log(usage);
    process.exitCode = 1;
    return;
  }
  const commonPerLevel = readOption("per-level");
  function perLevelOf(difficulty: TsumeShogiDifficulty): number {
    return commonPerLevel === undefined
      ? defaultPerLevel[difficulty]
      : readPositiveInteger("per-level", 0);
  }
  const surplus = readPositiveNumber("surplus", 1.3);
  const jobs = readPositiveInteger("jobs", 4);
  const block = readPositiveInteger("block", 40);
  const budget = readPositiveInteger("budget", 6000);
  const oracleResultsPath = readOption("oracle-results");
  const oracleResults =
    oracleResultsPath === undefined
      ? null
      : readOracleResults(oracleResultsPath);
  const startedAt = performance.now();

  const store = readCache(cachePath);
  for (;;) {
    const selectable = selectAllLevels(store, perLevelOf, oracleResults);
    const pending = tsumeShogiDifficulties
      .map(({ id }) => id)
      .filter(
        (id) =>
          countClassified(store, id) < perLevelOf(id) * surplus ||
          selectable.get(id)!.selected.length < perLevelOf(id),
      );
    if (oracleResults !== null && pending.length > 0) {
      throw new Error(
        `Levels ${pending.join(", ")} do not have enough candidates checked by the oracle; generate and check more candidates first`,
      );
    }
    if (pending.length === 0) {
      break;
    }
    const requiredLengths = new Map<string, number>();
    for (const difficulty of pending) {
      for (const condition of listTsumeShogiGenerationConditions(
        difficulty,
      ).map(formatTsumeShogiGenerationConditionsText)) {
        const length = Math.min(store.get(condition)!.length + block, budget);
        requiredLengths.set(
          condition,
          Math.max(requiredLengths.get(condition) ?? 0, length),
        );
      }
    }
    if (
      [...requiredLengths].every(
        ([condition, length]) => store.get(condition)!.length >= length,
      )
    ) {
      throw new Error(
        `Levels ${pending.join(", ")} could not reach the surplus within ${budget} candidates per condition`,
      );
    }
    await extendCandidates(store, requiredLengths, jobs, cachePath);
    console.error(
      `${Math.round((performance.now() - startedAt) / 1000)}s ${tsumeShogiDifficulties
        .map(
          ({ id }) =>
            `${id}:${countClassified(store, id)}/${Math.ceil(perLevelOf(id) * surplus)}`,
        )
        .join(" ")}`,
    );
  }
  const wallSeconds = (performance.now() - startedAt) / 1000;

  const oracleInputPath = readOption("oracle-input");
  if (oracleInputPath !== undefined) {
    writeOracleInput(oracleInputPath, store);
  }

  const selections = selectAllLevels(store, perLevelOf, oracleResults);

  const levels = Object.fromEntries(
    tsumeShogiDifficulties.map(({ id }) => [
      id,
      selections.get(id)!.selected.map((candidate) => candidate.entry!),
    ]),
  ) as Record<TsumeShogiDifficulty, TsumeShogiProblemPoolEntry[]>;
  const json = formatPoolJson(levels);
  writeFileSync(outputPath, json);

  const allCandidates = [...store.values()].flat();
  const report: string[] = [
    `候補 ${allCandidates.length}: ${formatCounts(allCandidates.map((candidate) => candidate.difficulty ?? candidate.outcome))}`,
    `生成条件ごとの候補数: ${[...store].map(([condition, candidates]) => `${condition}=${candidates.length}`).join(" ")}`,
    `候補の生成＋分析の計算 ${(allCandidates.reduce((sum, candidate) => sum + candidate.milliseconds, 0) / 1000).toFixed(0)}s (CPU)`,
  ];
  for (const { id: difficulty } of tsumeShogiDifficulties) {
    const { selected, classifiedCount, skipped } = selections.get(difficulty)!;
    report.push(
      `## レベル ${difficulty}: ${selected.length}問`,
      `  分類された候補 ${classifiedCount} / 飛ばした候補: ${[...skipped].map(([reason, count]) => `${reason}=${count}`).join(" ") || "なし"}`,
      `  生成条件: ${formatCounts(selected.map((candidate) => candidate.condition))}`,
      `  生成＋分析時間 (ms): ${describeDistribution(selected.map((candidate) => candidate.milliseconds))}`,
      ...describeLevelEntries(
        selected.map((candidate) => ({
          entry: candidate.entry!,
          fingerprint: candidate.fingerprint!,
          features: candidate.features!,
        })),
      ),
      describeOracle(selected, oracleResults),
    );
  }
  const detailsPath = readOption("details");
  if (detailsPath !== undefined) {
    writeFileSync(
      detailsPath,
      `${tsumeShogiDifficulties
        .flatMap(({ id }) =>
          selections.get(id)!.selected.map((candidate, entryIndex) =>
            JSON.stringify({
              problemId: formatTsumeShogiPoolProblemId(id, entryIndex),
              seed: candidate.seed,
              sfen: candidate.sfen,
              mainLine: candidate.entry![2],
              ...candidate.features,
              motif: candidate.fingerprint!.motif,
              oracle: oracleResults?.get(candidate.sfen!) ?? null,
            }),
          ),
        )
        .join("\n")}\n`,
    );
  }
  console.log(report.join("\n"));
  console.log(
    `\n全体: ${wallSeconds.toFixed(1)}s (wall, jobs=${jobs}) / ${describeSize(json)}`,
  );
}

type VerifyRecord =
  | {
      kind: "ok";
      difficulty: TsumeShogiDifficulty;
      index: number;
      fingerprint: TsumeShogiProblemFingerprint;
      features: CandidateFeatures;
    }
  | {
      kind: "failure";
      difficulty: TsumeShogiDifficulty;
      index: number;
      reason: string;
    };

function verifyEntry(
  difficulty: TsumeShogiDifficulty,
  index: number,
): VerifyRecord {
  function fail(reason: string): VerifyRecord {
    return { kind: "failure", difficulty, index, reason };
  }
  const entry = listTsumeShogiPoolEntries(difficulty)[index]!;
  const pooled = toTsumeShogiPooledProblem(difficulty, index);
  const generated = generateTsumeShogiProblem(pooled.identity);
  const regenerated = toPoolEntry(pooled.identity.seed, generated.problem);
  if (regenerated.join("|") !== entry.join("|")) {
    return fail("identity から再生成した問題が問題集と違う");
  }
  const analysis = analyzeTsumeShogiDifficulty(pooled.problem);
  if (analysis.status !== "analyzed") {
    return fail(`分析できない (${analysis.status}: ${analysis.reason})`);
  }
  const assessment = assessTsumeShogiDifficulty(analysis);
  if (
    assessment.status !== "classified" ||
    assessment.difficulty !== difficulty
  ) {
    return fail(`レベルが一致しない (${JSON.stringify(assessment)})`);
  }
  return {
    kind: "ok",
    difficulty,
    index,
    fingerprint: createTsumeShogiProblemFingerprint(pooled.problem),
    features: summarizeFeatures(analysis.features),
  };
}

function runVerifyWorker(args: readonly string[]): void {
  const [jobIndex, jobCount] = args.map(Number);
  let position = 0;
  for (const { id: difficulty } of tsumeShogiDifficulties) {
    listTsumeShogiPoolEntries(difficulty).forEach((_, index) => {
      if (position % jobCount! === jobIndex) {
        console.log(JSON.stringify(verifyEntry(difficulty, index)));
      }
      position += 1;
    });
  }
}

function measureSelection(): string {
  const durations: number[] = [];
  for (const { id: difficulty } of tsumeShogiDifficulties) {
    for (let index = 0; index < 2000; index += 1) {
      const startedAt = performance.now();
      selectTsumeShogiProblemForDifficulty(difficulty, `measure-${index}`);
      durations.push(performance.now() - startedAt);
    }
  }
  durations.sort((left, right) => left - right);
  const mean =
    durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return `選択+復元 ${durations.length}回: mean=${mean.toFixed(3)}ms p99=${quantile(durations, 0.99).toFixed(3)}ms max=${durations.at(-1)!.toFixed(3)}ms`;
}

/**
 * 問題集の全体で、seed・局面・作意の指紋が重ならず、各レベルの中で攻方の手順の指紋が重ならず、各レベルが手筋の偏りの
 * 上限を守るか。違反の説明を返す。
 */
function checkDuplicatesAndBiases(
  records: readonly Extract<VerifyRecord, { kind: "ok" }>[],
): string[] {
  const violations: string[] = [];
  for (const key of ["position", "solution"] as const) {
    const values = records.map(({ fingerprint }) => fingerprint[key]);
    const duplicateCount = values.length - new Set(values).size;
    if (duplicateCount > 0) {
      violations.push(`${key} の指紋の重複 ${duplicateCount}`);
    }
  }
  const seeds = tsumeShogiDifficulties.flatMap(({ id }) =>
    listTsumeShogiPoolEntries(id).map(([seed]) => seed),
  );
  if (new Set(seeds).size !== seeds.length) {
    violations.push(`seed の重複 ${seeds.length - new Set(seeds).size}`);
  }
  for (const { id: difficulty } of tsumeShogiDifficulties) {
    const level = records.filter((record) => record.difficulty === difficulty);
    const entries = listTsumeShogiPoolEntries(difficulty);
    const count = entries.length;
    const attacks = new Set(level.map(({ fingerprint }) => fingerprint.attack));
    if (attacks.size < level.length) {
      violations.push(
        `レベル ${difficulty} の攻方の手順の指紋の重複 ${level.length - attacks.size}`,
      );
    }
    const motifCounts = new Map<string, number>();
    for (const { fingerprint } of level) {
      motifCounts.set(
        fingerprint.motif,
        (motifCounts.get(fingerprint.motif) ?? 0) + 1,
      );
    }
    const largestMotif = Math.max(...motifCounts.values());
    if (largestMotif > limitOf(count, MOTIF_SHARE_LIMIT)) {
      violations.push(`レベル ${difficulty} の手筋の列の最多 ${largestMotif}`);
    }
    const sacrificeKingCaptures = level.filter(({ fingerprint }) =>
      startsWithSacrificeKingCapture(fingerprint),
    ).length;
    if (
      sacrificeKingCaptures > limitOf(count, SACRIFICE_KING_CAPTURE_SHARE_LIMIT)
    ) {
      violations.push(
        `レベル ${difficulty} の初手の捨駒を玉で取らせる筋 ${sacrificeKingCaptures}`,
      );
    }
    const finalDrops = entries.filter(endsWithDrop).length;
    if (finalDrops > limitOf(count, finalDropShareLimits[difficulty])) {
      violations.push(`レベル ${difficulty} の最終手の駒打ち ${finalDrops}`);
    }
  }
  return violations;
}

async function runVerify(): Promise<void> {
  const jobs = readPositiveInteger("jobs", 4);
  const startedAt = performance.now();
  const outputs = await Promise.all(
    Array.from({ length: jobs }, async (_, jobIndex) => {
      const worker = Bun.spawn(
        [
          process.execPath,
          Bun.fileURLToPath(import.meta.url),
          "--verify-worker",
          String(jobIndex),
          String(jobs),
        ],
        { stdout: "pipe", stderr: "inherit" },
      );
      const output = await new Response(worker.stdout).text();
      if ((await worker.exited) !== 0) {
        throw new Error(`Verify worker ${jobIndex} failed`);
      }
      return output;
    }),
  );
  const records = outputs
    .join("\n")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as VerifyRecord);
  const failures = records.flatMap((record) =>
    record.kind === "failure" ? [record] : [],
  );
  const passed = records.flatMap((record) =>
    record.kind === "ok" ? [record] : [],
  );
  const violations = checkDuplicatesAndBiases(passed);

  console.log(
    `${records.length}問を検証 (${((performance.now() - startedAt) / 1000).toFixed(1)}s, jobs=${jobs}): 不合格 ${failures.length} / 重複・偏りの違反 ${violations.length}`,
  );
  for (const failure of failures) {
    console.log(
      `  レベル ${failure.difficulty} の ${failure.index + 1}番: ${failure.reason}`,
    );
  }
  for (const violation of violations) {
    console.log(`  ${violation}`);
  }
  const levels = {} as Record<
    TsumeShogiDifficulty,
    TsumeShogiProblemPoolEntry[]
  >;
  for (const { id: difficulty } of tsumeShogiDifficulties) {
    levels[difficulty] = [...listTsumeShogiPoolEntries(difficulty)];
    const sources = passed
      .filter((record) => record.difficulty === difficulty)
      .sort((left, right) => left.index - right.index)
      .map((record) => ({
        entry: levels[difficulty][record.index]!,
        fingerprint: record.fingerprint,
        features: record.features,
      }));
    console.log(
      [
        `レベル ${difficulty}: ${levels[difficulty].length}問`,
        ...describeLevelEntries(sources),
      ].join("\n"),
    );
  }
  console.log(describeSize(formatPoolJson(levels)));
  console.log(measureSelection());
  if (failures.length > 0 || violations.length > 0) {
    process.exitCode = 1;
  }
}

if (Bun.argv.includes("--help")) {
  console.log(usage);
} else if (Bun.argv.includes("--worker")) {
  runWorker(Bun.argv.slice(Bun.argv.indexOf("--worker") + 1));
} else if (Bun.argv.includes("--verify-worker")) {
  runVerifyWorker(Bun.argv.slice(Bun.argv.indexOf("--verify-worker") + 1));
} else if (Bun.argv.includes("--verify")) {
  await runVerify();
} else {
  await runMain();
}
