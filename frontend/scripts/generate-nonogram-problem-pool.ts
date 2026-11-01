import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { difficultyLevels } from "@/games/difficulty";
import {
  assessNonogramDifficulty,
  type NonogramDifficulty,
  nonogramLevelCombinations,
} from "@/games/nonogram/difficulty";
import {
  analyzeNonogramDifficulty,
  measureNonogramClueShape,
  type NonogramReadingFeatures,
  toNonogramAnalyzedDifficulty,
} from "@/games/nonogram/problem/difficulty-analysis";
import { measureNonogramPatternQuality } from "@/games/nonogram/problem/generation/pattern-quality";
import { countNonogramSolutions } from "@/games/nonogram/problem/generation/solution-count";
import { getNonogramSymmetryKey } from "@/games/nonogram/problem/generation/symmetry";
import {
  generateNonogramProblem,
  type NonogramCandidateRejection,
} from "@/games/nonogram/problem/generator";
import {
  createNonogramProblemIdentity,
  NONOGRAM_GENERATOR_VERSION,
  type NonogramPatternStyle,
  nonogramPatternStyles,
} from "@/games/nonogram/problem/problem";
import {
  decodeNonogramPoolEntry,
  decodeNonogramPoolSolution,
  encodeNonogramPoolSolution,
  formatNonogramPoolProblemId,
  listNonogramPoolEntries,
  type NonogramPooledProblem,
  type NonogramProblemPoolEntry,
  restoreNonogramPoolEntry,
  toNonogramPooledProblem,
} from "@/games/nonogram/problem/problem-pool";
import { selectNonogramProblemForDifficulty } from "@/games/nonogram/problem-selection";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import { computeNonogramClues } from "@/games/nonogram/puzzle/clue";

const defaultPerLevel = 500;

/**
 * 問題集の版。問題の並び（問題番号 `<レベル>-<番号>` が指す問題）が変わる作り直しをしたら上げる。
 * 生成器の版（`NONOGRAM_GENERATOR_VERSION`）が上がったときも並びは変わるので上げる。
 */
const poolVersion = "1";

/**
 * レベルごとに候補を作る図柄の作り方。生成条件は候補を作る領域を決めるだけで、採るかどうかは分析・分類で決める。
 * 行・列あたりの塊の数は平滑化の回数でほぼ決まる（各レベルの連鎖の深さの帯に入る候補の p10〜p90 で、
 * 平滑化2回は 1.0〜1.8、1回は 1.1〜2.1、なしは 1.8〜3.3）。レベルの塊の数の範囲に当たる候補がほとんどできない
 * 平滑化の回数は、候補の上限まで調べても採れないので除く。レベル1・2は平滑化1〜2回、レベル3は0〜1回、
 * レベル4・5は平滑化なしにする。
 * レベル5は、黒の確率 0.60 以上では連鎖の深い問題が候補1000個に1問ほどしかできないので 0.45〜0.55 に絞り、
 * 左右対称だと決めつけて推論を飛ばせるので左右対称を除く。
 */
const levelPatternStyles: Record<
  NonogramDifficulty,
  readonly NonogramPatternStyle[]
> = {
  "1": nonogramPatternStyles.filter(
    ({ smoothingCount }) => smoothingCount >= 1,
  ),
  "2": nonogramPatternStyles.filter(
    ({ smoothingCount }) => smoothingCount >= 1,
  ),
  "3": nonogramPatternStyles.filter(
    ({ smoothingCount }) => smoothingCount <= 1,
  ),
  "4": nonogramPatternStyles.filter(
    ({ smoothingCount }) => smoothingCount === 0,
  ),
  "5": nonogramPatternStyles.filter(
    ({ blackProbability, smoothingCount, mirrored }) =>
      blackProbability <= 0.55 && smoothingCount === 0 && !mirrored,
  ),
};

const usage = `Usage: bun run generate:nonogram-pool -- [options]

レベルごとに、組み合わせ定義（nonogramLevelCombinations）の盤面の大きさとレベルの図柄の作り方の組（生成条件）で、
決定的な seed の候補を番号順に生成・分析する。そのレベルに分類された候補を、回転・反転の同型の重複を除きながら
生成条件を巡回して問題集へ採る。

Options:
  --per-level <n>  レベルごとの問題数 (default: ${defaultPerLevel})
  --jobs <n>       並列ワーカー数 (default: 4)
  --block <n>      生成条件ごとに一度に増やす候補数 (default: 500)
  --budget <n>     生成条件ごとに調べる候補数の上限 (default: 30000)
  --cache <dir>    候補の評価結果（線の読みの特徴まで。塊の分かれ方とレベルの分類は含めない）を生成条件ごとに書き足す。
                   同じ dir で実行し直すと、評価済みの候補を読んで今の分類の境界で分類し直し、続きから進める
  --verify         生成せず、同梱の問題集の全問を identity から再生成→解の数え上げ→分析→分類し、特徴・同型の重複・
                   JSON の大きさ・選択時間を確かめる`;

const outputPath = new URL(
  "../src/games/nonogram/problem/problem-pool.json",
  import.meta.url,
);

type Condition = { size: NonogramGridSize; styleIndex: number };

/** 特徴を測れた候補の、分類と問題集に採るための値。 */
type AnalyzedCandidate = {
  symmetryKey: string;
  encodedSolution: string;
  features: NonogramReadingFeatures;
};

/**
 * 1つの候補を生成・分析した結果。キャッシュにはこの形で書く。
 * `outcome` は生成器が除いた理由、分析で特徴を測れなかった理由、または特徴を測れた `analyzed`。
 * レベルの分類は持たず、読むたびに `classifyCandidate` で今の分類の境界から求める。塊の分かれ方は解から求まるので持たない。
 */
type CandidateEvaluation = {
  index: number;
  milliseconds: number;
} & (
  | { outcome: NonogramCandidateRejection | "unsupported" | "invalid" }
  | { outcome: "analyzed"; analyzed: AnalyzedCandidate }
);

const unanalyzedOutcomes: ReadonlySet<unknown> = new Set([
  "pattern-requirements",
  "not-line-solvable",
  "unsupported",
  "invalid",
] satisfies (NonogramCandidateRejection | "unsupported" | "invalid")[]);

/**
 * 評価を分類した候補。`outcome` は評価で特徴を測れなかった理由、どのレベルにも当たらない `out-of-range`、
 * または分類されたレベル。分類された候補だけが問題集に採るための値（`classified`）を持つ。
 */
type Candidate = {
  index: number;
  milliseconds: number;
  outcome:
    | NonogramCandidateRejection
    | "unsupported"
    | "invalid"
    | "out-of-range"
    | `L${NonogramDifficulty}`;
  classified?: AnalyzedCandidate & { difficulty: NonogramDifficulty };
};

type ConditionState = {
  condition: Condition;
  /** 候補番号の順。0 から連続して埋まる。 */
  results: Candidate[];
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

function getStyle(styleIndex: number): NonogramPatternStyle {
  const style = nonogramPatternStyles[styleIndex];
  if (style === undefined) {
    throw new RangeError(`Unknown Nonogram pattern style: ${styleIndex}`);
  }
  return style;
}

function describeStyle({
  blackProbability,
  smoothingCount,
  mirrored,
}: NonogramPatternStyle): string {
  return `d${blackProbability.toFixed(2)}-s${smoothingCount}-${mirrored ? "m" : "n"}`;
}

function describeSize({ width, height }: NonogramGridSize): string {
  return `${width}×${height}`;
}

function conditionKeyOf({ size, styleIndex }: Condition): string {
  return `${size.width}x${size.height}-${styleIndex}`;
}

function evaluateCandidate(
  condition: Condition,
  index: number,
): CandidateEvaluation {
  const startedAt = performance.now();
  const generated = generateNonogramProblem(
    createNonogramProblemIdentity(
      condition.size,
      getStyle(condition.styleIndex),
      index,
    ),
  );
  if (generated.status === "rejected") {
    return {
      index,
      milliseconds: performance.now() - startedAt,
      outcome: generated.reason,
    };
  }
  const { problem, symmetryKey } = generated.generated;
  const analysis = analyzeNonogramDifficulty(problem);
  const milliseconds = performance.now() - startedAt;
  if (analysis.status !== "analyzed") {
    return { index, milliseconds, outcome: analysis.status };
  }
  return {
    index,
    milliseconds,
    outcome: "analyzed",
    analyzed: {
      symmetryKey,
      encodedSolution: encodeNonogramPoolSolution(problem.solution),
      features: analysis.features,
    },
  };
}

function classifyCandidate(
  { size: { width, height } }: Condition,
  evaluation: CandidateEvaluation,
): Candidate {
  const { index, milliseconds } = evaluation;
  if (evaluation.outcome !== "analyzed") {
    return { index, milliseconds, outcome: evaluation.outcome };
  }
  const solution = decodeNonogramPoolSolution(
    { width, height },
    evaluation.analyzed.encodedSolution,
  );
  const assessment = assessNonogramDifficulty(
    toNonogramAnalyzedDifficulty(
      computeNonogramClues(solution),
      evaluation.analyzed.features,
    ),
  );
  if (assessment.status !== "classified") {
    return { index, milliseconds, outcome: assessment.status };
  }
  return {
    index,
    milliseconds,
    outcome: `L${assessment.difficulty}`,
    classified: { ...evaluation.analyzed, difficulty: assessment.difficulty },
  };
}

/** キャッシュの1行を読む。書きかけの行・形の違う行には `null` を返す。 */
function parseCandidateEvaluation(line: string): CandidateEvaluation | null {
  let value: {
    index?: unknown;
    outcome?: unknown;
    analyzed?: { features?: unknown };
  };
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  const isEvaluation =
    typeof value.index === "number" &&
    (value.outcome === "analyzed"
      ? value.analyzed?.features !== undefined
      : unanalyzedOutcomes.has(value.outcome));
  return isEvaluation ? (value as CandidateEvaluation) : null;
}

function runWorker(args: readonly string[]): void {
  const [width, height, styleIndex, start, count] = args.map(Number);
  const condition = {
    size: { width: width!, height: height! },
    styleIndex: styleIndex!,
  };
  const end = start! + count!;
  for (let index = start!; index < end; index += 1) {
    console.log(JSON.stringify(evaluateCandidate(condition, index)));
  }
}

type Batch = { state: ConditionState; start: number; count: number };

async function runBatch({
  state,
  start,
  count,
}: Batch): Promise<CandidateEvaluation[]> {
  const { size, styleIndex } = state.condition;
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      String(size.width),
      String(size.height),
      String(styleIndex),
      String(start),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker failed for ${conditionKeyOf(state.condition)}`);
  }
  const evaluations = output
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CandidateEvaluation);
  if (evaluations.length !== count) {
    throw new Error(
      `Worker for ${conditionKeyOf(state.condition)} returned ${evaluations.length} of ${count} candidates`,
    );
  }
  return evaluations;
}

/** 候補の評価を生成条件ごとのファイルに書き足し、実行し直したときに読み戻して分類する。 */
type CandidateCache = {
  load(state: ConditionState): void;
  append(
    state: ConditionState,
    evaluations: readonly CandidateEvaluation[],
  ): void;
};

function formatEvaluationLines(
  evaluations: readonly CandidateEvaluation[],
): string {
  return evaluations
    .map((evaluation) => `${JSON.stringify(evaluation)}\n`)
    .join("");
}

function createCandidateCache(directory: string | undefined): CandidateCache {
  if (directory === undefined) {
    return { load() {}, append() {} };
  }
  mkdirSync(directory, { recursive: true });
  function pathOf(state: ConditionState): string {
    return join(
      directory!,
      `v${NONOGRAM_GENERATOR_VERSION}-${conditionKeyOf(state.condition)}.jsonl`,
    );
  }
  return {
    load(state) {
      let text: string;
      try {
        text = readFileSync(pathOf(state), "utf8");
      } catch {
        return;
      }
      const evaluations: CandidateEvaluation[] = [];
      for (const line of text.split("\n")) {
        if (line.length === 0) {
          continue;
        }
        const evaluation = parseCandidateEvaluation(line);
        if (evaluation?.index !== evaluations.length) {
          break;
        }
        evaluations.push(evaluation);
      }
      // 書いている途中で止めた行があれば、そこから先を捨てて書き直し、続きを評価し直す。
      writeFileSync(pathOf(state), formatEvaluationLines(evaluations));
      state.results.push(
        ...evaluations.map((evaluation) =>
          classifyCandidate(state.condition, evaluation),
        ),
      );
    },
    append(state, evaluations) {
      appendFileSync(pathOf(state), formatEvaluationLines(evaluations));
    },
  };
}

/** 1つのワーカーに渡す候補数の上限。重い条件を細かく分け、ワーカーの手が空かないようにする。 */
const maximumBatchSize = 250;

async function runBatches(
  batches: readonly Batch[],
  jobs: number,
  cache: CandidateCache,
): Promise<void> {
  const queue = batches.flatMap((batch) =>
    Array.from(
      { length: Math.ceil(batch.count / maximumBatchSize) },
      (_, part): Batch => ({
        state: batch.state,
        start: batch.start + part * maximumBatchSize,
        count: Math.min(
          maximumBatchSize,
          batch.count - part * maximumBatchSize,
        ),
      }),
    ),
  );
  // 生成条件ごとに、終わったバッチを開始の候補番号で待たせる。
  const finished = new Map<ConditionState, Map<number, CandidateEvaluation[]>>(
    batches.map(({ state }) => [state, new Map()]),
  );
  /**
   * 完了順ではなく候補番号の順に積む。次に積む番号から途切れず揃ったバッチをその都度積んでキャッシュへ書き足すので、
   * 途中で止めても、そこまでに揃った評価は次の実行で読み戻せる。
   */
  function appendContiguous(state: ConditionState): void {
    const waiting = finished.get(state)!;
    for (
      let evaluations = waiting.get(state.results.length);
      evaluations !== undefined;
      evaluations = waiting.get(state.results.length)
    ) {
      waiting.delete(state.results.length);
      state.results.push(
        ...evaluations.map((evaluation) =>
          classifyCandidate(state.condition, evaluation),
        ),
      );
      cache.append(state, evaluations);
    }
  }
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      for (let batch = queue.shift(); batch; batch = queue.shift()) {
        const evaluations = await runBatch(batch);
        finished.get(batch.state)!.set(batch.start, evaluations);
        appendContiguous(batch.state);
      }
    }),
  );
}

type SelectedCandidate = {
  condition: Condition;
  candidate: Candidate & { classified: NonNullable<Candidate["classified"]> };
};

type LevelSelection =
  | {
      status: "selected";
      selected: SelectedCandidate[];
      duplicateCount: number;
      /** 生成条件ごとの、採る問題を決めるまでに調べた候補数。 */
      examinedLengths: Map<ConditionState, number>;
    }
  /** 巡回の `round` 周目で、まだ調べていない候補に届いた。その周目に届く採れる候補が無い条件の候補を増やす。 */
  | { status: "needs-more"; round: number };

/**
 * 生成条件を巡回し、各条件の採れる候補を番号順に1つずつ採る。同型の重複は飛ばす。
 * 採る問題は各条件の候補の番号順の並びだけで決まり、ワーカー数・一度に調べる候補数・キャッシュに依存しない。
 * 候補が上限まで尽きた条件は飛ばし、残りの条件で埋める。
 */
function selectLevel(
  difficulty: NonogramDifficulty,
  states: readonly ConditionState[],
  perLevel: number,
  budget: number,
): LevelSelection {
  const queues = states.map((state) =>
    state.results
      .slice(0, budget)
      .filter(
        (candidate): candidate is SelectedCandidate["candidate"] =>
          candidate.classified?.difficulty === difficulty,
      ),
  );
  const selected: SelectedCandidate[] = [];
  const examinedLengths = new Map<ConditionState, number>(
    states.map((state) => [state, 0]),
  );
  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  for (let round = 0; selected.length < perLevel; round += 1) {
    let hasCandidate = false;
    for (const [conditionIndex, state] of states.entries()) {
      if (selected.length >= perLevel) {
        break;
      }
      const candidate = queues[conditionIndex]![round];
      if (!candidate) {
        if (state.results.length < budget) {
          return { status: "needs-more", round };
        }
        continue;
      }
      hasCandidate = true;
      examinedLengths.set(state, candidate.index + 1);
      if (seenKeys.has(candidate.classified.symmetryKey)) {
        duplicateCount += 1;
        continue;
      }
      seenKeys.add(candidate.classified.symmetryKey);
      selected.push({ condition: state.condition, candidate });
    }
    if (!hasCandidate) {
      throw new Error(
        `Level ${difficulty} could not reach ${perLevel} problems within ${budget} candidates per condition`,
      );
    }
  }
  return { status: "selected", selected, duplicateCount, examinedLengths };
}

function countClassified(
  state: ConditionState,
  difficulty: NonogramDifficulty,
): number {
  return state.results.filter(
    (candidate) => candidate.classified?.difficulty === difficulty,
  ).length;
}

function quantile(sorted: readonly number[], ratio: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))
  ]!;
}

const distributionQuantiles = [
  ["min", 0],
  ["p10", 0.1],
  ["median", 0.5],
  ["p90", 0.9],
] as const;

function describeDistribution(values: readonly number[], digits = 0): string {
  const sorted = [...values].sort((left, right) => left - right);
  return [
    ...distributionQuantiles.map(
      ([label, ratio]) => `${label}=${quantile(sorted, ratio).toFixed(digits)}`,
    ),
    `max=${sorted.at(-1)!.toFixed(digits)}`,
  ].join(" ");
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

function formatPercent(count: number, total: number): string {
  return `${((count / total) * 100).toFixed(1)}%`;
}

function formatPoolJson(
  levels: Record<NonogramDifficulty, readonly NonogramProblemPoolEntry[]>,
): string {
  const lines = difficultyLevels.map(
    ({ id }, levelIndex) =>
      `    ${JSON.stringify(id)}: [\n${levels[id]
        .map((entry) => `      ${JSON.stringify(entry)}`)
        .join(
          ",\n",
        )}\n    ]${levelIndex < difficultyLevels.length - 1 ? "," : ""}`,
  );
  return `{\n  "poolVersion": ${JSON.stringify(poolVersion)},\n  "generatorVersion": ${JSON.stringify(NONOGRAM_GENERATOR_VERSION)},\n  "levels": {\n${lines.join("\n")}\n  }\n}\n`;
}

function describeJsonSize(json: string): string {
  return `JSON ${json.length} bytes, gzip ${gzipSync(json).length} bytes`;
}

/** 問題集の1レベルの内訳（盤面の大きさ・図柄の作り方・難易度の特徴・塊の分かれ方・図柄の見た目の量）。 */
function describeLevelEntries(
  difficulty: NonogramDifficulty,
  entries: readonly NonogramProblemPoolEntry[],
): string[] {
  const pooled = entries.map((entry, entryIndex) => ({
    ...restoreNonogramPoolEntry(entry, {
      poolVersion,
      problemId: formatNonogramPoolProblemId(difficulty, entryIndex),
    }),
    features: decodeNonogramPoolEntry(entry).features,
  }));
  const qualities = pooled.map(({ problem }) =>
    measureNonogramPatternQuality(problem.solution),
  );
  const clueLines = pooled.map(({ problem }) => [
    ...problem.clues.rows,
    ...problem.clues.columns,
  ]);
  function featureOf(
    select: (features: NonogramReadingFeatures) => number,
  ): number[] {
    return pooled.map(({ features }) => select(features));
  }
  const sizes = [
    ...new Set(pooled.map(({ problem }) => describeSize(problem))),
  ];
  return [
    `  盤面: ${formatCounts(pooled.map(({ problem }) => describeSize(problem)))}`,
    `  図柄の作り方: ${formatCounts(pooled.map(({ identity }) => describeStyle(identity.conditions)))}`,
    `  連鎖の深さ: ${describeDistribution(featureOf(({ roundCount }) => roundCount))}`,
    `  最初に進められる行・列: ${describeDistribution(featureOf(({ entryLineCount }) => entryLineCount))}`,
    `  最初の段で決まる割合: ${describeDistribution(
      pooled.map(
        ({ problem, features }) =>
          features.firstRoundFixedCellCount / (problem.width * problem.height),
      ),
      2,
    )}`,
    `  細い段の数: ${describeDistribution(featureOf(({ narrowRoundCount }) => narrowRoundCount))}`,
    `  進められる行・列の最小: ${describeDistribution(featureOf(({ minimumProgressedLineCount }) => minimumProgressedLineCount))}`,
    `  行・列あたりの塊の数: ${describeDistribution(
      pooled.map(
        ({ problem }) =>
          measureNonogramClueShape(problem.clues).blockCountPerLine,
      ),
      2,
    )}`,
    `  塊が1つだけの行・列の割合: ${describeDistribution(
      clueLines.map(
        (lines) =>
          lines.filter((clue) => clue.length === 1).length / lines.length,
      ),
      2,
    )}`,
    `  端寄せでは進まない読みを含む: ${formatPercent(featureOf(({ readingsBeyondEdgesCount }) => readingsBeyondEdgesCount).filter((count) => count > 0).length, pooled.length)}`,
    `  黒の割合: ${describeDistribution(
      qualities.map(({ blackRatio }) => blackRatio),
      2,
    )}`,
    `  黒の塊の数: ${describeDistribution(qualities.map(({ blackComponentCount }) => blackComponentCount))}`,
    `  左右対称: ${formatPercent(qualities.filter(({ mirrorSymmetric }) => mirrorSymmetric).length, pooled.length)}`,
    ...sizes.map((size) => {
      const rounds = pooled
        .filter(({ problem }) => describeSize(problem) === size)
        .map(({ features }) => features.roundCount);
      return `  ${size} の連鎖の深さ: ${describeDistribution(rounds)}`;
    }),
  ];
}

async function runMain(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", defaultPerLevel);
  const jobs = readPositiveInteger("jobs", 4);
  const block = readPositiveInteger("block", 500);
  const budget = readPositiveInteger("budget", 30_000);
  const cache = createCandidateCache(readOption("cache"));
  const startedAt = performance.now();

  const statesByKey = new Map<string, ConditionState>();
  const levelStates = Object.fromEntries(
    difficultyLevels.map(({ id }) => [
      id,
      levelPatternStyles[id].flatMap((style) =>
        nonogramLevelCombinations[id].boardSizes.map((size) => {
          const condition = {
            size,
            styleIndex: nonogramPatternStyles.indexOf(style),
          };
          const key = conditionKeyOf(condition);
          let state = statesByKey.get(key);
          if (state === undefined) {
            state = { condition, results: [] };
            cache.load(state);
            statesByKey.set(key, state);
          }
          return state;
        }),
      ),
    ]),
  ) as Record<NonogramDifficulty, ConditionState[]>;

  const results = new Map<
    NonogramDifficulty,
    Extract<LevelSelection, { status: "selected" }>
  >();
  for (;;) {
    const requiredLengths = new Map<ConditionState, number>();
    for (const { id: difficulty } of difficultyLevels) {
      if (results.has(difficulty)) {
        continue;
      }
      const selection = selectLevel(
        difficulty,
        levelStates[difficulty],
        perLevel,
        budget,
      );
      if (selection.status === "selected") {
        results.set(difficulty, selection);
        continue;
      }
      for (const state of levelStates[difficulty]) {
        if (
          countClassified(state, difficulty) <= selection.round &&
          state.results.length < budget
        ) {
          requiredLengths.set(
            state,
            Math.min(state.results.length + block, budget),
          );
        }
      }
    }
    if (requiredLengths.size === 0) {
      break;
    }
    await runBatches(
      [...requiredLengths].map(([state, length]) => ({
        state,
        start: state.results.length,
        count: length - state.results.length,
      })),
      jobs,
      cache,
    );
    console.error(
      `${Math.round((performance.now() - startedAt) / 1000)}s ${difficultyLevels
        .map(
          ({ id }) =>
            `${id}:${
              results.has(id)
                ? "done"
                : levelStates[id].reduce(
                    (sum, state) => sum + countClassified(state, id),
                    0,
                  )
            }`,
        )
        .join(" ")}`,
    );
  }
  const wallSeconds = (performance.now() - startedAt) / 1000;

  const levels = {} as Record<NonogramDifficulty, NonogramProblemPoolEntry[]>;
  for (const { id: difficulty } of difficultyLevels) {
    levels[difficulty] = results
      .get(difficulty)!
      .selected.map(({ condition, candidate }) => {
        const { encodedSolution, features } = candidate.classified;
        return [
          condition.size.width,
          condition.size.height,
          condition.styleIndex,
          candidate.index,
          encodedSolution,
          features.roundCount,
          features.entryLineCount,
          features.firstRoundFixedCellCount,
          features.minimumProgressedLineCount,
          features.narrowRoundCount,
          features.readingsBeyondEdgesCount,
        ];
      });
  }

  const report: string[] = [];
  for (const { id: difficulty } of difficultyLevels) {
    const { selected, duplicateCount, examinedLengths } =
      results.get(difficulty)!;
    const examined = levelStates[difficulty].flatMap((state) =>
      state.results.slice(0, examinedLengths.get(state)),
    );
    const classifiedCount = examined.filter(
      (candidate) => candidate.classified?.difficulty === difficulty,
    ).length;
    const cpuSeconds =
      examined.reduce((sum, candidate) => sum + candidate.milliseconds, 0) /
      1000;
    const exhaustedConditions = levelStates[difficulty].filter(
      (state) => examinedLengths.get(state) === 0,
    );
    report.push(
      `## レベル ${difficulty}: ${selected.length}問（生成条件 ${levelStates[difficulty].length}）`,
      `  候補 ${examined.length} / 分類一致 ${classifiedCount} (${formatPercent(classifiedCount, examined.length)}) / 同型重複 ${duplicateCount} / 候補の計算 ${cpuSeconds.toFixed(1)}s (CPU)`,
      `  調べた候補の結果: ${formatCounts(examined.map((candidate) => candidate.outcome))}`,
      `  1問も採らなかった生成条件: ${exhaustedConditions.length === 0 ? "なし" : exhaustedConditions.map(({ condition }) => `${describeSize(condition.size)}/${describeStyle(getStyle(condition.styleIndex))}`).join(" ")}`,
      ...describeLevelEntries(difficulty, levels[difficulty]),
    );
  }

  const json = formatPoolJson(levels);
  writeFileSync(outputPath, json);
  console.log(report.join("\n"));
  console.log(
    `\n全体: ${wallSeconds.toFixed(1)}s (wall, jobs=${jobs}) / ${describeJsonSize(json)}`,
  );
}

type VerifyFailure = {
  difficulty: NonogramDifficulty;
  index: number;
  reason: string;
};

function findVerifyFailure(
  difficulty: NonogramDifficulty,
  entry: NonogramProblemPoolEntry,
  pooled: NonogramPooledProblem,
): string | null {
  const generated = generateNonogramProblem(pooled.identity);
  if (generated.status !== "accepted") {
    return `identity から再生成した候補を生成器が採らない (${generated.reason})`;
  }
  if (
    encodeNonogramPoolSolution(generated.generated.problem.solution) !==
    entry[4]
  ) {
    return "identity から再生成した問題が問題集と違う";
  }
  const search = countNonogramSolutions(pooled.problem.clues);
  if (search.status !== "complete" || search.solutionCount !== 1) {
    return `解がただ1つでない (${search.status}, ${search.solutionCount})`;
  }
  const analysis = analyzeNonogramDifficulty(pooled.problem);
  if (analysis.status !== "analyzed") {
    return `線の読みだけで解けない (${analysis.status})`;
  }
  const { features } = decodeNonogramPoolEntry(entry);
  if (JSON.stringify(analysis.features) !== JSON.stringify(features)) {
    return `特徴が分析と違う (${JSON.stringify(features)} / ${JSON.stringify(analysis.features)})`;
  }
  const assessment = assessNonogramDifficulty(analysis);
  if (
    assessment.status !== "classified" ||
    assessment.difficulty !== difficulty
  ) {
    return `レベルが一致しない (${JSON.stringify(assessment)})`;
  }
  return null;
}

function runVerifyWorker(args: readonly string[]): void {
  const [jobIndex, jobCount] = args.map(Number);
  for (const { id: difficulty } of difficultyLevels) {
    listNonogramPoolEntries(difficulty).forEach((entry, index) => {
      if (index % jobCount! !== jobIndex) {
        return;
      }
      const reason = findVerifyFailure(
        difficulty,
        entry,
        toNonogramPooledProblem(difficulty, index),
      );
      if (reason !== null) {
        console.log(JSON.stringify({ difficulty, index, reason }));
      }
    });
  }
}

function measureSelection(): string {
  const durations: number[] = [];
  for (const { id: difficulty } of difficultyLevels) {
    for (let index = 0; index < 2000; index += 1) {
      const startedAt = performance.now();
      selectNonogramProblemForDifficulty(difficulty, `measure-${index}`);
      durations.push(performance.now() - startedAt);
    }
  }
  durations.sort((left, right) => left - right);
  const mean =
    durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return `選択+復元 ${durations.length}回: mean=${mean.toFixed(3)}ms p99=${quantile(durations, 0.99).toFixed(3)}ms max=${durations.at(-1)!.toFixed(3)}ms`;
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
  const failures = outputs
    .join("\n")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as VerifyFailure);

  // 同型の重複と seed の重複は、レベルをまたいで確かめる。
  const keys = new Set<string>();
  const seeds = new Set<string>();
  let duplicateCount = 0;
  let total = 0;
  const levels = {} as Record<NonogramDifficulty, NonogramProblemPoolEntry[]>;
  for (const { id: difficulty } of difficultyLevels) {
    levels[difficulty] = [...listNonogramPoolEntries(difficulty)];
    for (const entry of levels[difficulty]) {
      total += 1;
      const [width, height, , , encodedSolution] = entry;
      const key = getNonogramSymmetryKey(
        decodeNonogramPoolSolution({ width, height }, encodedSolution),
      );
      const { seed } = decodeNonogramPoolEntry(entry).identity;
      if (keys.has(key) || seeds.has(seed)) {
        duplicateCount += 1;
      }
      keys.add(key);
      seeds.add(seed);
    }
  }

  console.log(
    `${total}問を検証 (${((performance.now() - startedAt) / 1000).toFixed(1)}s, jobs=${jobs}): 不合格 ${failures.length} / 同型・seed の重複 ${duplicateCount}`,
  );
  for (const failure of failures) {
    console.log(
      `  レベル ${failure.difficulty} の ${failure.index + 1}番: ${failure.reason}`,
    );
  }
  for (const { id: difficulty } of difficultyLevels) {
    console.log(
      [
        `レベル ${difficulty}: ${levels[difficulty].length}問`,
        ...describeLevelEntries(difficulty, levels[difficulty]),
      ].join("\n"),
    );
  }
  console.log(describeJsonSize(formatPoolJson(levels)));
  console.log(measureSelection());
  if (failures.length > 0 || duplicateCount > 0) {
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
