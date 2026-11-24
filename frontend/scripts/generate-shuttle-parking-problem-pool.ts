import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { difficultyLevels } from "@/games/difficulty";
import {
  assessShuttleParkingDifficulty,
  SHUTTLE_PARKING_ANALYSIS_LEVEL_WEIGHTS,
  SHUTTLE_PARKING_CLASSIFICATION_RULES,
  SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION,
  type ShuttleParkingDifficulty,
} from "@/games/shuttle-parking/difficulty";
import {
  analyzeShuttleParkingDifficulty,
  type ShuttleParkingDifficultyAnalysis,
} from "@/games/shuttle-parking/problem/difficulty-analysis";
import {
  countSharedShuttleParkingCars,
  createShuttleParkingPlayKey,
  createShuttleParkingVisualKey,
  isShuttleParkingTrivial,
} from "@/games/shuttle-parking/problem/generation/duplicates";
import {
  countShuttleParkingBacktracks,
  SHUTTLE_PARKING_RESEARCH_RULES,
} from "@/games/shuttle-parking/problem/generation/naive-rules";
import {
  measureShuttleParkingLookAheadWinProbability,
  measureShuttleParkingTrapMoves,
  measureShuttleParkingWeightBounds,
  ShuttleParkingReader,
} from "@/games/shuttle-parking/problem/generation/readers";
import { AnalysisGame } from "@/games/shuttle-parking/problem/generation/state-game";
import {
  generateShuttleParkingCandidate,
  SHUTTLE_PARKING_LOT_SIZES,
  SHUTTLE_PARKING_OPENINGS,
  type ShuttleParkingGenerationConditions,
  type ShuttleParkingOpening,
} from "@/games/shuttle-parking/problem/generator";
import {
  createShuttleParkingProblemSeed,
  SHUTTLE_PARKING_GENERATOR_VERSION,
  type ShuttleParkingProblem,
} from "@/games/shuttle-parking/problem/problem";
import {
  decodeShuttleParkingPoolEntry,
  restoreShuttleParkingPoolEntry,
  restoreShuttleParkingSeed,
  type ShuttleParkingProblemPool,
} from "@/games/shuttle-parking/problem/problem-pool";
import { countShuttleParkingStates } from "@/games/shuttle-parking/puzzle/clearability";

function formatUsage(): string {
  return `Usage: bun run generate:shuttle-parking-pool -- [options]

生成条件（駐車場の大きさ × 出口の辺）の4組ごとに候補を番号順に作って分析し、結果を候補ごとに保存する（--cache）。
保存した候補から、各組の中では候補番号の順に、分類され、どう出しても必ず勝つ問題でなく、見た目のキー・解き味のキーが
採った問題と重ならず、同じレベルの採った問題と（回転・反転して）車を7台以上共有しない問題を採る。各レベルでは組を巡回して並べる。
採る問題は保存の順やワーカー数に依存しない。止めても、同じ --cache で流し直せば続きから作る。

Options:
  --per-level <n>      各レベルの問題数 (default: 500)
  --cache <dir>        候補の分析結果の置き場所 (default: ${defaultCacheDirectory})
  --limit <n>          1つの組で分析する候補の上限 (default: 400000)
  --batch <n>          1つのワーカーに渡す候補の数 (default: 500)
  --jobs <n>           並列ワーカー数 (default: 4)
  --seconds <n>        この秒数を過ぎたら、渡したバッチを終えて止める（続きは流し直す） (default: 無制限)
  --pool <file>        書く・読む問題集のファイル (default: src/games/shuttle-parking/problem/problem-pool.json)
  --stats              問題集を書かず、保存した候補と問題集の分布を出す
  --verify             問題集を書かず、今の問題集の全問を分析し直して確かめる`;
}

const outputPath =
  readOption("pool") ??
  new URL(
    "../src/games/shuttle-parking/problem/problem-pool.json",
    import.meta.url,
  ).pathname;
const defaultCacheDirectory = path.join(tmpdir(), "shuttle-parking-pool-cache");

/** 生成条件の組。この順に巡回して並べる。 */
const combos: readonly ShuttleParkingGenerationConditions[] =
  SHUTTLE_PARKING_LOT_SIZES.flatMap((size) =>
    (Object.keys(SHUTTLE_PARKING_OPENINGS) as ShuttleParkingOpening[]).map(
      (opening) => ({ size, opening }),
    ),
  );

/** 同じレベルの採った問題とこの台数以上の車（位置・向き・定員）を共有する問題は採らない。 */
const SHARED_CAR_LIMIT = 7;

function comboLabel({ size, opening }: ShuttleParkingGenerationConditions) {
  return `${size}${opening}`;
}

function candidateSeed(comboIndex: number, index: number): string {
  return `shuttle-parking:${comboLabel(combos[comboIndex]!)}:${index}`;
}

/**
 * 候補1つの分析結果。`entry` は問題の符号（範囲の外の候補は `null`）。`level` は今の判定、`researchLevel` は調査コードと同じ決まり（規則8つ、進め方を広げた確かめなし）での判定。
 * `trivial` はどう出しても必ず勝つか。
 */
type CandidateResult = {
  combo: number;
  index: number;
  entry: string | null;
  level: ShuttleParkingDifficulty | null;
  reason: string | null;
  researchLevel: ShuttleParkingDifficulty | null;
  trivial: boolean;
  /** 分類された問題の、見た目のキーと解き味のキー。 */
  keys: [visual: string, play: string] | null;
  features: CandidateFeatures | null;
};

type CandidateFeatures = {
  bays: number;
  best: [number, number];
  cont: [number, number];
  window: [number, number];
  free: number;
  rules: number[];
  decisions: number[];
};

function summarize(
  analysis: ShuttleParkingDifficultyAnalysis,
): CandidateFeatures | null {
  if (analysis.status !== "analyzed") return null;
  const { features } = analysis;
  return {
    bays: features.bayCount,
    best: [features.headFirst.best.minimum, features.headFirst.best.maximum],
    cont: [
      features.headFirst.continuation.minimum,
      features.headFirst.continuation.maximum,
    ],
    window: [features.window.minimum, features.window.maximum],
    free: features.freePathMinimumWeight,
    rules: Object.values(features.rules),
    decisions: [
      ...features.decisions.best.minimum,
      ...features.decisions.best.maximum,
    ],
  };
}

function analyzeCandidate(comboIndex: number, index: number): CandidateResult {
  const problem = generateShuttleParkingCandidate(
    combos[comboIndex]!,
    candidateSeed(comboIndex, index),
  );
  if (!problem) {
    return {
      combo: comboIndex,
      index,
      entry: null,
      level: null,
      reason: "bayCountOutOfRange",
      researchLevel: null,
      trivial: false,
      keys: null,
      features: null,
    };
  }
  const analysis = analyzeShuttleParkingDifficulty(
    problem,
    SHUTTLE_PARKING_ANALYSIS_LEVEL_WEIGHTS,
  );
  const assessment = assessShuttleParkingDifficulty(analysis);
  const research = assessShuttleParkingDifficulty(analysis, {
    rules: SHUTTLE_PARKING_RESEARCH_RULES,
    tieBreaks: "uniform",
    checksFreePath: false,
    checksNaiveReader: false,
  });
  return {
    combo: comboIndex,
    index,
    entry: createShuttleParkingProblemSeed(problem),
    level: assessment.status === "classified" ? assessment.difficulty : null,
    reason:
      assessment.status === "out-of-range" ||
      assessment.status === "unsupported"
        ? assessment.reason
        : null,
    researchLevel:
      research.status === "classified" ? research.difficulty : null,
    trivial:
      assessment.status === "classified" && isShuttleParkingTrivial(problem),
    keys:
      assessment.status === "classified"
        ? [
            createShuttleParkingVisualKey(problem),
            createShuttleParkingPlayKey(problem),
          ]
        : null,
    features: summarize(analysis),
  };
}

function readOption(name: string): string | undefined {
  const index = Bun.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : Bun.argv[index + 1];
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = readOption(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function cacheFile(directory: string, comboIndex: number): string {
  return path.join(directory, `${comboLabel(combos[comboIndex]!)}.jsonl`);
}

function readCache(
  directory: string,
): Map<number, Map<number, CandidateResult>> {
  const cache = new Map<number, Map<number, CandidateResult>>();
  combos.forEach((_, comboIndex) => {
    const results = new Map<number, CandidateResult>();
    const file = cacheFile(directory, comboIndex);
    if (existsSync(file)) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!line) continue;
        const result = JSON.parse(line) as CandidateResult;
        results.set(result.index, result);
      }
    }
    cache.set(comboIndex, results);
  });
  return cache;
}

function runWorker(args: readonly string[]): void {
  const [comboIndex, first, count] = args.map(Number);
  for (let index = first!; index < first! + count!; index += 1) {
    console.log(JSON.stringify(analyzeCandidate(comboIndex!, index)));
  }
}

async function runBatch(
  directory: string,
  comboIndex: number,
  first: number,
  count: number,
): Promise<void> {
  const worker = Bun.spawn(
    [
      process.execPath,
      Bun.fileURLToPath(import.meta.url),
      "--worker",
      String(comboIndex),
      String(first),
      String(count),
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(worker.stdout).text();
  if ((await worker.exited) !== 0) {
    throw new Error(`Worker failed for ${comboLabel(combos[comboIndex]!)}`);
  }
  appendFileSync(cacheFile(directory, comboIndex), output);
}

type Selection = {
  /** レベルごと・組ごとの、採った問題（候補番号順）。 */
  accepted: Map<ShuttleParkingDifficulty, CandidateResult[][]>;
  /** 組ごとに、候補番号の切れ目なく分析し終えた数。 */
  contiguous: number[];
};

/**
 * 保存した候補から採る。組の中は候補番号順に、全組をまたいで「組0の0番、組1の0番、…、組0の1番…」の順で重なりを見る。
 * 番号の抜けがある所から先はまだ見ない（分析し終えた範囲だけで決める）。1つの組の1つのレベルからは、多くても `perLevel` 問。
 */
function select(
  cache: Map<number, Map<number, CandidateResult>>,
  perLevel: number,
): Selection {
  const contiguous = combos.map((_, comboIndex) => {
    const results = cache.get(comboIndex)!;
    let count = 0;
    while (results.has(count)) count += 1;
    return count;
  });
  const accepted = new Map(
    difficultyLevels.map(({ id }) => [
      id,
      combos.map(() => [] as CandidateResult[]),
    ]),
  );
  const visualKeys = new Set<string>();
  const playKeys = new Set<string>();
  const problemsByLevel = new Map<
    ShuttleParkingDifficulty,
    ShuttleParkingProblem[]
  >(difficultyLevels.map(({ id }) => [id, []]));
  const longest = Math.max(...contiguous);
  for (let index = 0; index < longest; index += 1) {
    combos.forEach((_, comboIndex) => {
      if (index >= contiguous[comboIndex]!) return;
      const result = cache.get(comboIndex)!.get(index)!;
      if (
        result.level === null ||
        result.entry === null ||
        result.trivial ||
        !result.keys
      ) {
        return;
      }
      const level = result.level;
      const levelAccepted = accepted.get(level)!;
      if (levelAccepted[comboIndex]!.length >= perLevel) return;
      const [visual, play] = result.keys;
      if (visualKeys.has(visual) || playKeys.has(play)) return;
      const { problem } = restoreShuttleParkingSeed(result.entry);
      if (
        problemsByLevel
          .get(level)!
          .some(
            (other) =>
              countSharedShuttleParkingCars(problem, other) >= SHARED_CAR_LIMIT,
          )
      ) {
        return;
      }
      visualKeys.add(visual);
      playKeys.add(play);
      problemsByLevel.get(level)!.push(problem);
      levelAccepted[comboIndex]!.push(result);
    });
  }
  return { accepted, contiguous };
}

/** 組を巡回して並べる。足りない組は飛ばし、残りの組で埋める。 */
function interleave(
  byCombo: readonly (readonly CandidateResult[])[],
  perLevel: number,
): CandidateResult[] {
  const ordered: CandidateResult[] = [];
  const positions = byCombo.map(() => 0);
  while (ordered.length < perLevel) {
    let added = false;
    byCombo.forEach((results, comboIndex) => {
      if (ordered.length >= perLevel) return;
      const result = results[positions[comboIndex]!];
      if (!result) return;
      ordered.push(result);
      positions[comboIndex]! += 1;
      added = true;
    });
    if (!added) break;
  }
  return ordered;
}

/** 各組が自分の分を満たしたか、満たさない組があっても巡回して並べると全レベルが `perLevel` 問そろうか。 */
function isComboSatisfied(
  selection: Selection,
  comboIndex: number,
  perLevel: number,
): boolean {
  const quota = Math.ceil(perLevel / combos.length);
  return difficultyLevels.every(
    ({ id }) => selection.accepted.get(id)![comboIndex]!.length >= quota,
  );
}

function isPoolSatisfied(selection: Selection, perLevel: number): boolean {
  return difficultyLevels.every(
    ({ id }) =>
      interleave(selection.accepted.get(id)!, perLevel).length >= perLevel,
  );
}

async function generate(): Promise<void> {
  const perLevel = readPositiveInteger("per-level", 500);
  const directory = readOption("cache") ?? defaultCacheDirectory;
  const limit = readPositiveInteger("limit", 400_000);
  const batch = readPositiveInteger("batch", 500);
  const jobs = readPositiveInteger("jobs", 4);
  const seconds = readOption("seconds");
  const deadline =
    seconds === undefined
      ? Number.POSITIVE_INFINITY
      : performance.now() + Number(seconds) * 1000;
  mkdirSync(directory, { recursive: true });

  for (;;) {
    const cache = readCache(directory);
    const selection = select(cache, perLevel);
    const allCombosSatisfied = combos.every((_, comboIndex) =>
      isComboSatisfied(selection, comboIndex, perLevel),
    );
    // 自分の分を満たさない組を先に回す。その組が上限まで回しても足りなければ、ほかの組で埋める。
    const lacking = combos.flatMap((_, comboIndex) => {
      const next = selection.contiguous[comboIndex]!;
      return !isComboSatisfied(selection, comboIndex, perLevel) && next < limit
        ? [{ comboIndex, next }]
        : [];
    });
    const filling =
      lacking.length === 0 && !isPoolSatisfied(selection, perLevel)
        ? combos.flatMap((_, comboIndex) => {
            const next = selection.contiguous[comboIndex]!;
            return next < limit ? [{ comboIndex, next }] : [];
          })
        : [];
    const pending = lacking.length ? lacking : filling;
    const satisfied =
      allCombosSatisfied ||
      (lacking.length === 0 && isPoolSatisfied(selection, perLevel));
    logProgress(selection, perLevel);
    if (satisfied || pending.length === 0) {
      writePool(selection, perLevel);
      return;
    }
    if (performance.now() > deadline) {
      console.log("時間切れ。同じ --cache で流し直すと続きから作る");
      return;
    }
    const tasks = Array.from({ length: jobs }, (_, job) => {
      const target = pending[job % pending.length]!;
      const round = Math.floor(job / pending.length);
      return runBatch(
        directory,
        target.comboIndex,
        target.next + round * batch,
        batch,
      );
    });
    await Promise.all(tasks);
  }
}

function logProgress(selection: Selection, perLevel: number): void {
  const quota = Math.ceil(perLevel / combos.length);
  const rows = difficultyLevels.map(
    ({ id }) =>
      `Lv${id}: ${selection.accepted
        .get(id)!
        .map(
          (results, comboIndex) =>
            `${comboLabel(combos[comboIndex]!)} ${results.length}/${quota}`,
        )
        .join(", ")}`,
  );
  console.log(
    `分析済み: ${selection.contiguous.map((count, comboIndex) => `${comboLabel(combos[comboIndex]!)} ${count}`).join(", ")}\n${rows.join("\n")}`,
  );
}

function writePool(selection: Selection, perLevel: number): void {
  const levels = Object.fromEntries(
    difficultyLevels.map(({ id }) => {
      const ordered = interleave(selection.accepted.get(id)!, perLevel);
      if (ordered.length < perLevel) {
        throw new Error(
          `Lv${id} の問題が足りない: ${ordered.length}/${perLevel}`,
        );
      }
      return [
        id,
        ordered.map(({ entry, features }) => [entry!, features!.best[0]]),
      ];
    }),
  ) as unknown as ShuttleParkingProblemPool["levels"];
  const pool: ShuttleParkingProblemPool = {
    generatorVersion: SHUTTLE_PARKING_GENERATOR_VERSION,
    difficultyModelVersion: SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION,
    levels,
  };
  writeFileSync(outputPath, `${JSON.stringify(pool)}\n`);
  console.log(
    `問題集を書いた: ${difficultyLevels.map(({ id }) => `Lv${id} ${levels[id].length}`).join(", ")}`,
  );
}

function printStats(): void {
  const directory = readOption("cache") ?? defaultCacheDirectory;
  const cache = readCache(directory);
  const all = [...cache.values()].flatMap((results) => [...results.values()]);
  const count = (predicate: (result: CandidateResult) => boolean) =>
    all.filter(predicate).length;
  console.log(`候補 ${all.length}`);
  combos.forEach((combo, comboIndex) => {
    const results = [...cache.get(comboIndex)!.values()];
    const tally = new Map<string, number>();
    for (const result of results) {
      const key = result.level ? `Lv${result.level}` : (result.reason ?? "?");
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    console.log(
      `${comboLabel(combo)} ${results.length}: ${[...tally]
        .sort()
        .map(([key, value]) => `${key} ${value}`)
        .join(", ")}`,
    );
  });
  for (const { id } of difficultyLevels) {
    const research = count((result) => result.researchLevel === id);
    const product = count((result) => result.level === id);
    const kept = count(
      (result) => result.researchLevel === id && result.level === id,
    );
    console.log(
      `Lv${id}: 調査の判定 ${research} → 今の判定 ${product}（調査の判定のまま残った ${kept}）、必ず勝つ ${count((result) => result.level === id && result.trivial)}`,
    );
  }
  printPoolStats();
}

function formatPercentiles(values: readonly number[]): string {
  const sorted = [...values].sort((first, second) => first - second);
  const at = (share: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))]!;
  const format = (value: number) =>
    Number.isInteger(value) ? `${value}` : value.toFixed(2);
  return [sorted[0]!, at(0.1), at(0.5), at(0.9), sorted.at(-1)!]
    .map(format)
    .join("/");
}

type PoolRow = {
  level: ShuttleParkingDifficulty;
  problem: ShuttleParkingProblem;
  values: Record<string, number>;
};

const LOOK_AHEAD_MOVES = 4;

/** 隣のレベルで、上のレベルの問題が下のレベルの問題より「難しい側」に出る確率（同点は半分）。 */
function printLevelOrder(rows: readonly PoolRow[]): void {
  const measures: [string, (row: PoolRow) => number][] = [
    ["戻す回数", (row) => row.values.試し出しで戻す回数!],
    [
      "規則で負ける",
      (row) => -row.values["素朴な規則の最高勝率（同点の選び方の最大）"]!,
    ],
    ["無作為で負ける", (row) => -row.values.一様に無作為な人の勝率!],
  ];
  for (let index = 0; index + 1 < difficultyLevels.length; index += 1) {
    const lower = rows.filter(
      (row) => row.level === difficultyLevels[index]!.id,
    );
    const upper = rows.filter(
      (row) => row.level === difficultyLevels[index + 1]!.id,
    );
    const text = measures.map(([name, measure]) => {
      let score = 0;
      for (const low of lower) {
        for (const high of upper) {
          const difference = measure(high) - measure(low);
          score += difference > 0 ? 1 : difference === 0 ? 0.5 : 0;
        }
      }
      return `${name} ${(score / lower.length / upper.length).toFixed(2)}`;
    });
    console.log(`隣のレベル ${index + 1}-${index + 2}: ${text.join("、")}`);
  }
}

/** 問題集の全問を分析し直し、レベルごとの分布（最小/10/50/90/最大）を出す（検査 B1・B2・C1・D1）。 */
function printPoolStats(): void {
  const pool = JSON.parse(
    readFileSync(outputPath, "utf8"),
  ) as ShuttleParkingProblemPool;
  const rows: PoolRow[] = difficultyLevels.flatMap(({ id }) =>
    pool.levels[id].map((entry) => {
      const { problem } = restoreShuttleParkingPoolEntry(entry);
      const analysis = analyzeShuttleParkingDifficulty(
        problem,
        SHUTTLE_PARKING_ANALYSIS_LEVEL_WEIGHTS,
      );
      if (analysis.status !== "analyzed") throw new Error(entry[0]);
      const { features } = analysis;
      const game = new AnalysisGame(problem);
      return {
        level: id,
        problem,
        values: {
          重さ: features.headFirst.best.minimum,
          "重さ（気づかず続けた場合）": features.headFirst.continuation.minimum,
          先回りする人の重さ: features.window.minimum,
          進め方を広げた重さ: features.freePathMinimumWeight,
          "素朴な規則の最高勝率（同点は一様）": Math.max(
            ...Object.values(features.rules),
          ),
          "素朴な規則の最高勝率（同点の選び方の最大）": Math.max(
            ...Object.values(features.bestRules),
          ),
          "罠の重さを手数で（記録だけ）": measureShuttleParkingTrapMoves(
            new ShuttleParkingReader(game, "best"),
          ),
          "4手先まで読む人の勝率（記録だけ）":
            measureShuttleParkingLookAheadWinProbability(
              new ShuttleParkingReader(game, "best"),
              LOOK_AHEAD_MOVES,
            ),
          "出せる車すべてを候補にした重さ（記録だけ）":
            measureShuttleParkingWeightBounds(
              new ShuttleParkingReader(game, "best"),
              ["all"],
            ).minimum,
          一様に無作為な人の勝率: game.uniformWinProbability(),
          試し出しで戻す回数: countShuttleParkingBacktracks(game).backtracks,
          "判断の回数（重さ1以上・記録だけ）":
            features.decisions.best.minimum[0]!,
          "判断の回数（重さ5以上・記録だけ）":
            features.decisions.best.minimum[1]!,
          列の人数: problem.passengers.length,
          初めに出せる車: game.geometricMoves(game.full).length,
        },
      };
    }),
  );
  console.log(`問題集 ${rows.length}問（最小/10/50/90/最大）`);
  for (const name of Object.keys(rows[0]!.values)) {
    console.log(
      `${name}: ${difficultyLevels
        .map(
          ({ id }) =>
            `Lv${id} ${formatPercentiles(rows.filter((row) => row.level === id).map((row) => row.values[name]!))}`,
        )
        .join(" | ")}`,
    );
  }
  printLevelOrder(rows);
  for (const { id } of difficultyLevels) {
    const levelRows = rows.filter((row) => row.level === id);
    const share = (predicate: (row: PoolRow) => boolean) =>
      `${((levelRows.filter(predicate).length / levelRows.length) * 100).toFixed(0)}%`;
    const colors = new Map<number, number>();
    for (const row of levelRows) {
      const count = new Set(row.problem.lot.cars.map(({ color }) => color))
        .size;
      colors.set(count, (colors.get(count) ?? 0) + 1);
    }
    console.log(
      `Lv${id}: 4手先まで読む人が勝率0.8以上 ${share((row) => row.values["4手先まで読む人の勝率（記録だけ）"]! >= 0.8)}、出せる車すべてで5人以上先の罠 ${share((row) => row.values["出せる車すべてを候補にした重さ（記録だけ）"]! >= 5)}、色の数 ${[
        ...colors,
      ]
        .sort()
        .map(([count, value]) => `${count}色 ${value}`)
        .join(", ")}`,
    );
  }
  let crossLevelPairs = 0;
  rows.forEach((row, index) => {
    for (const other of rows.slice(index + 1)) {
      if (
        other.level !== row.level &&
        countSharedShuttleParkingCars(row.problem, other.problem) >=
          SHARED_CAR_LIMIT
      ) {
        crossLevelPairs += 1;
      }
    }
  });
  console.log(
    `レベルをまたいで車を7台以上共有する組（除かない）: ${crossLevelPairs}`,
  );
  for (const size of SHUTTLE_PARKING_LOT_SIZES) {
    console.log(
      `${size}×${size} の重さ: ${difficultyLevels
        .map(
          ({ id }) =>
            `Lv${id} ${formatPercentiles(rows.filter((row) => row.level === id && row.problem.lot.size === size).map((row) => row.values.重さ!))}`,
        )
        .join(" | ")}`,
    );
  }
  for (const { id } of difficultyLevels) {
    const tally = new Map<number, number>();
    for (const row of rows.filter((candidate) => candidate.level === id)) {
      tally.set(
        row.problem.bayCount,
        (tally.get(row.problem.bayCount) ?? 0) + 1,
      );
    }
    console.log(
      `Lv${id} の待機枠: ${[...tally]
        .sort()
        .map(([bays, value]) => `${bays}か所 ${value}`)
        .join(", ")}`,
    );
  }
}

async function verify(): Promise<void> {
  const pool = JSON.parse(
    readFileSync(outputPath, "utf8"),
  ) as ShuttleParkingProblemPool;
  const perLevel = readPositiveInteger("per-level", 500);
  const failures: string[] = [];
  const visualKeys = new Map<string, string>();
  const playKeys = new Map<string, string>();
  if (pool.generatorVersion !== SHUTTLE_PARKING_GENERATOR_VERSION) {
    failures.push(`generatorVersion ${pool.generatorVersion}`);
  }
  if (
    pool.difficultyModelVersion !== SHUTTLE_PARKING_DIFFICULTY_MODEL_VERSION
  ) {
    failures.push(`difficultyModelVersion ${pool.difficultyModelVersion}`);
  }
  const startedAt = performance.now();
  for (const { id } of difficultyLevels) {
    const entries = pool.levels[id];
    if (entries.length !== perLevel)
      failures.push(`Lv${id}: ${entries.length}問`);
    const problems: ShuttleParkingProblem[] = [];
    entries.forEach((entry, position) => {
      const { problem, trapWeight } = restoreShuttleParkingPoolEntry(entry);
      const [seed] = entry;
      const label = `Lv${id} #${position + 1} ${seed}`;
      if (createShuttleParkingProblemSeed(problem) !== seed)
        failures.push(`${label}: 符号に戻せない`);
      const analysis = analyzeShuttleParkingDifficulty(
        problem,
        SHUTTLE_PARKING_ANALYSIS_LEVEL_WEIGHTS,
      );
      const assessment = assessShuttleParkingDifficulty(
        analysis,
        SHUTTLE_PARKING_CLASSIFICATION_RULES,
      );
      if (
        analysis.status !== "analyzed" ||
        analysis.features.headFirst.best.minimum !== trapWeight
      )
        failures.push(`${label}: 罠の重さ ${trapWeight}`);
      if (assessment.status !== "classified" || assessment.difficulty !== id) {
        failures.push(`${label}: 判定 ${JSON.stringify(assessment)}`);
      }
      if (isShuttleParkingTrivial(problem))
        failures.push(`${label}: どう出しても勝つ`);
      try {
        countShuttleParkingStates(problem);
      } catch {
        failures.push(`${label}: 状態の数が上限を超える`);
      }
      const visual = createShuttleParkingVisualKey(problem);
      const play = createShuttleParkingPlayKey(problem);
      const sameVisual = visualKeys.get(visual);
      const samePlay = playKeys.get(play);
      if (sameVisual)
        failures.push(`${label}: 見た目のキーが ${sameVisual} と同じ`);
      if (samePlay)
        failures.push(`${label}: 解き味のキーが ${samePlay} と同じ`);
      visualKeys.set(visual, label);
      playKeys.set(play, label);
      const shared = problems.findIndex(
        (other) =>
          countSharedShuttleParkingCars(problem, other) >= SHARED_CAR_LIMIT,
      );
      if (shared >= 0)
        failures.push(`${label}: Lv${id} #${shared + 1} と車を7台以上共有する`);
      problems.push(problem);
      const identity = decodeShuttleParkingPoolEntry(entry);
      if (identity.conditions.size !== problem.lot.size)
        failures.push(`${label}: 大きさ`);
    });
  }
  console.log(
    `${difficultyLevels.length * perLevel}問を検証（${((performance.now() - startedAt) / 1000).toFixed(1)}s）: 不合格 ${failures.length}`,
  );
  for (const failure of failures.slice(0, 50)) console.log(failure);
  if (failures.length) process.exit(1);
}

if (Bun.argv.includes("--help")) {
  console.log(formatUsage());
} else if (Bun.argv.includes("--worker")) {
  runWorker(Bun.argv.slice(Bun.argv.indexOf("--worker") + 1));
} else if (Bun.argv.includes("--verify")) {
  await verify();
} else if (Bun.argv.includes("--stats")) {
  printStats();
} else {
  await generate();
}
