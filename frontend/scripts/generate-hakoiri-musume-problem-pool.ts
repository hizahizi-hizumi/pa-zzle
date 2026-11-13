import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  classifyHakoiriMusumeFeatures,
  type HakoiriMusumeDifficulty,
  hakoiriMusumeLevelCriteria,
} from "@/games/hakoiri-musume/difficulty";
import { countHakoiriMusumeProblemEmptyCells } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import classicPool from "@/games/hakoiri-musume/problem/generation/classic-pool.json";
import {
  countHakoiriMusumePieceSetEmptyCells,
  findHakoiriMusumeFamily,
  formatHakoiriMusumePieceSet,
  type HakoiriMusumeFamily,
  hakoiriMusumeFamilies,
  hakoiriMusumeMix,
  listHakoiriMusumeFamilyPieceSets,
} from "@/games/hakoiri-musume/problem/generation/families";
import {
  createHakoiriMusumeGeneralGraph,
  measureHakoiriMusumeGeneralGraph,
} from "@/games/hakoiri-musume/problem/generation/general-measure";
import {
  analyzeHakoiriMusumeFamilyPieceSet,
  createHakoiriMusumeSuperfluousCheck,
  type HakoiriMusumePickedProblem,
  type HakoiriMusumeSuperfluousCheck,
  pickHakoiriMusumePieceSetProblems,
} from "@/games/hakoiri-musume/problem/generation/general-selection";
import {
  createHakoiriMusumeProblemSpace,
  type HakoiriMusumeSpace,
  toHakoiriMusumePieces,
} from "@/games/hakoiri-musume/problem/generation/general-space";
import { confirmHakoiriMusumeNormalForm } from "@/games/hakoiri-musume/problem/generation/general-witness";
import {
  createHakoiriMusumeProblemIdentity,
  formatHakoiriMusumeProblemSeed,
  restoreHakoiriMusumeProblem,
} from "@/games/hakoiri-musume/problem/problem";
import type {
  HakoiriMusumeProblemPool,
  HakoiriMusumeProblemPoolEntry,
} from "@/games/hakoiri-musume/problem/problem-pool";
import { countHakoiriMusumeCells } from "@/games/hakoiri-musume/puzzle/board";
import {
  createProblemSeededRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";

const difficulties = [
  "1",
  "2",
  "3",
  "4",
  "5",
] as const satisfies readonly HakoiriMusumeDifficulty[];

function formatUsage(): string {
  return `Usage: bun run generate:hakoiri-musume-pool -- [options]

族（盤の作りのまとまり）ごとに駒の組を seed で並べ替え、組ごとに解ける盤面の全部を分析してレベルごとに採り、族の割合で混ぜて
各レベル ${hakoiriMusumeMix.problemsPerLevel} 問の問題集を作る。基準の盤（4×5）の問題は、前の問題集（classic-pool.json）の
問題のうち正規形の確かめと余計な駒の確かめを通るものから採り、問題 ID と記録をそのまま使う。駒の組ごとの結果はキャッシュに書く。

Options:
  --seed <seed>     並べ替えの seed (default: ${defaultSeed})
  --cache <dir>     駒の組ごとの結果を置くディレクトリ (default: ${defaultCacheDirectory})
  --verify          問題集を書かず、今の問題集の全問を分析し直して、レベル・値・正規形の確かめを確かめる。
                    前の問題集の基準の盤の問題の値が、今の物差しの値と一致することも確かめる
  --prepare-family <族>  その族の駒の組を割り当ての数まで分析してキャッシュに書くだけにする（生成が内部で並べて使う）`;
}

const defaultSeed = "20261112";
const defaultCacheDirectory = path.join(
  tmpdir(),
  "hakoiri-musume-general-pool-cache",
);
const poolPath = path.join(
  import.meta.dirname,
  "../src/games/hakoiri-musume/problem/problem-pool.json",
);

/** これを超える組は、時間とメモリのため分析しない。 */
const PIECE_SET_STATE_CAP = 1_500_000;
/** 4つ並べると、`SUPERFLUOUS_TABLE_STATE_CAP` の表で 15GB のメモリが足りなくなった。 */
const PARALLEL_FAMILIES = 3;
/** 余計な駒の確かめで、駒を1つ取り除いた組の全部の盤面の最短手数を表にする組の上限。 */
const SUPERFLUOUS_TABLE_STATE_CAP = 3_000_000;
/** その上限を超える組で、取り除いた盤からたどる盤面の数の上限。超えたら調べきれないとして採る。 */
const SUPERFLUOUS_SEARCH_STATE_CAP = 5_000;
const SHORT_PROBLEMS_FIRST = 30;
const INTRODUCTION_HOLD = 10;
const CLASSIC_FAMILY = "B45";

type PoolEntry = HakoiriMusumeProblemPoolEntry;
type ClassicLevels = Record<HakoiriMusumeDifficulty, PoolEntry[]>;

const classicLevels = (classicPool as unknown as { levels: ClassicLevels })
  .levels;

type PieceSetResult = {
  pieceSet: string;
  status: "analyzed" | "too-large";
  states: number;
  picked: Record<HakoiriMusumeDifficulty, PoolEntry[]>;
  rejected: Record<string, number>;
  seconds: number;
};

function toEntry(
  space: HakoiriMusumeSpace,
  problem: HakoiriMusumePickedProblem,
  familyId: string,
): PoolEntry {
  const pieces = toHakoiriMusumePieces(space, problem.key);
  return [
    formatHakoiriMusumeProblemSeed({ layout: space.spec.layout, pieces }),
    problem.optimalMoveCount,
    problem.preparationLength,
    problem.daughterDetourCount,
    problem.shortestPreparationLength,
    familyId,
  ];
}

/** キャッシュにあればそれを使う。 */
function analyzePieceSet(
  family: HakoiriMusumeFamily,
  pieceSet: Record<string, number>,
  seed: string,
  cacheDirectory: string,
): PieceSetResult {
  const name = formatHakoiriMusumePieceSet(pieceSet);
  const cachePath = path.join(
    cacheDirectory,
    `${family.id}-${seed}-${hakoiriMusumeMix.perPieceSetPerLevel}-${name.replaceAll(" ", "_")}.json`,
  );
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8")) as PieceSetResult;
  }
  const started = performance.now();
  const analysis = analyzeHakoiriMusumeFamilyPieceSet(
    family,
    pieceSet,
    PIECE_SET_STATE_CAP,
  );
  let result: PieceSetResult;
  if (analysis === null) {
    result = {
      pieceSet: name,
      status: "too-large",
      states: PIECE_SET_STATE_CAP,
      picked: { "1": [], "2": [], "3": [], "4": [], "5": [] },
      rejected: {},
      seconds: 0,
    };
  } else {
    const { picked, rejected } = pickHakoiriMusumePieceSetProblems(
      family,
      analysis,
      `${seed}:${family.id}:${name}`,
      hakoiriMusumeMix.perPieceSetPerLevel,
      createHakoiriMusumeSuperfluousCheck(
        analysis.space,
        SUPERFLUOUS_TABLE_STATE_CAP,
        SUPERFLUOUS_SEARCH_STATE_CAP,
      ),
    );
    result = {
      pieceSet: name,
      status: "analyzed",
      states: analysis.graph.keys.length,
      picked: Object.fromEntries(
        difficulties.map((level) => [
          level,
          picked[level].map((problem) =>
            toEntry(analysis.space, problem, family.id),
          ),
        ]),
      ) as Record<HakoiriMusumeDifficulty, PoolEntry[]>,
      rejected,
      seconds: 0,
    };
  }
  result.seconds = Math.round((performance.now() - started) / 100) / 10;
  writeFileSync(cachePath, JSON.stringify(result));
  return result;
}

/** 族の駒の組を seed の順にたどって分析し、レベルごとの必要な数がそろうまで続ける。 */
class FamilySupply {
  readonly results: PieceSetResult[] = [];
  private readonly pieceSets: Record<string, number>[];
  private readonly analyzed = new Set<number>();

  constructor(
    readonly family: HakoiriMusumeFamily,
    private readonly seed: string,
    private readonly cacheDirectory: string,
  ) {
    this.pieceSets = shuffleProblemValues(
      listHakoiriMusumeFamilyPieceSets(family) as Record<string, number>[],
      createProblemSeededRandom(`${seed}:${family.id}:piece-sets`),
    );
  }

  available(level: HakoiriMusumeDifficulty): number {
    return this.results.reduce(
      (sum, result) => sum + result.picked[level].length,
      0,
    );
  }

  /**
   * `level` の採れた数が `count` 以上になるまで、seed の順に駒の組を足す。空きの数がそのレベルの範囲に入らない組は、そのレベルの
   * 問題を出せないので飛ばす。
   */
  ensure(level: HakoiriMusumeDifficulty, count: number) {
    const { minimum, maximum } =
      hakoiriMusumeLevelCriteria[level].emptyCellCount;
    for (
      let index = 0;
      this.available(level) < count && index < this.pieceSets.length;
      index += 1
    ) {
      const pieceSet = this.pieceSets[index]!;
      const empties = countHakoiriMusumePieceSetEmptyCells(
        this.family,
        pieceSet,
      );
      if (this.analyzed.has(index) || empties < minimum || empties > maximum) {
        continue;
      }
      this.analyzed.add(index);
      const result = analyzePieceSet(
        this.family,
        pieceSet,
        this.seed,
        this.cacheDirectory,
      );
      this.results.push(result);
      console.error(
        `${this.family.id} ${result.pieceSet}: ${result.status} ${result.states} states, ${result.seconds}s, picked ${difficulties.map((each) => result.picked[each].length).join("/")}`,
      );
    }
  }

  /** `level` の問題を、駒の組の順に1問ずつ巡回して `count` 問まで取る。 */
  take(level: HakoiriMusumeDifficulty, count: number): PoolEntry[] {
    const lists = this.results.map((result) => result.picked[level]);
    const taken: PoolEntry[] = [];
    for (let round = 0; taken.length < count; round += 1) {
      const row = lists.flatMap((list) =>
        round < list.length ? [list[round]!] : [],
      );
      if (row.length === 0) {
        break;
      }
      taken.push(...row.slice(0, count - taken.length));
    }
    return taken;
  }
}

/**
 * 前の問題集の問題を前の並びの順に、レベルごとに返す。
 * 同じ駒の組・同じ連結成分の問題はまとめて分析する。
 */
function confirmClassicProblems(): ClassicLevels {
  const prepared = difficulties
    .flatMap((level) => classicLevels[level])
    .map(([board]) => {
      const { problem } = restoreHakoiriMusumeProblem(
        createHakoiriMusumeProblemIdentity(board),
      );
      return {
        board,
        pieceSet: [...board]
          .filter((character) => "vhs".includes(character))
          .sort()
          .join(""),
        ...createHakoiriMusumeProblemSpace(problem.layout, problem.pieces),
      };
    });
  const confirmed = new Map<string, boolean>();
  for (const first of prepared) {
    if (confirmed.has(first.board)) {
      continue;
    }
    const graph = createHakoiriMusumeGeneralGraph(first.space, [first.start])!;
    const measures = measureHakoiriMusumeGeneralGraph(graph);
    for (const other of prepared) {
      const state =
        other.pieceSet === first.pieceSet
          ? graph.indexByKey.get(other.start)
          : undefined;
      if (state === undefined || confirmed.has(other.board)) {
        continue;
      }
      confirmed.set(
        other.board,
        confirmHakoiriMusumeNormalForm(graph, measures, state) !== null,
      );
    }
  }
  return Object.fromEntries(
    difficulties.map((level) => [
      level,
      classicLevels[level]
        .filter(([board]) => confirmed.get(board))
        .map(
          ([board, optimal, preparation, detour, shortest]): PoolEntry => [
            board,
            optimal,
            preparation,
            detour,
            shortest,
            CLASSIC_FAMILY,
          ],
        ),
    ]),
  ) as ClassicLevels;
}

const classicSuperfluousChecks = new Map<
  string,
  HakoiriMusumeSuperfluousCheck
>();

/** 調べきれない駒は余計な駒に数えない。同じ駒の組の確かめは使い回す。 */
function hasNoSuperfluousPiece([board, optimal]: PoolEntry): boolean {
  const { problem } = restoreHakoiriMusumeProblem(
    createHakoiriMusumeProblemIdentity(board),
  );
  const { space, start } = createHakoiriMusumeProblemSpace(
    problem.layout,
    problem.pieces,
  );
  const pieceSet = JSON.stringify(space.spec.types);
  let check = classicSuperfluousChecks.get(pieceSet);
  if (!check) {
    check = createHakoiriMusumeSuperfluousCheck(
      space,
      SUPERFLUOUS_TABLE_STATE_CAP,
      SUPERFLUOUS_SEARCH_STATE_CAP,
    );
    classicSuperfluousChecks.set(pieceSet, check);
  }
  return check(start, optimal) !== true;
}

/** 端数は割合の大きい順に足す。 */
function allocate(level: HakoiriMusumeDifficulty): Map<string, number> {
  const shares = Object.entries(hakoiriMusumeMix.shares[level]);
  const total = hakoiriMusumeMix.problemsPerLevel;
  const counts = new Map(
    shares.map(([id, share]) => [id, Math.floor(share * total)]),
  );
  let left =
    total - [...counts.values()].reduce((sum, value) => sum + value, 0);
  for (const [id] of [...shares].sort((a, b) => b[1] - a[1])) {
    if (left === 0) {
      break;
    }
    counts.set(id, counts.get(id)! + 1);
    left -= 1;
  }
  return counts;
}

/** 族を問題の数に比例して滑らかに交互に並べ（重みつきの巡回）、並びの始めの決まりを当てる。 */
function arrangeLevel(
  level: HakoiriMusumeDifficulty,
  byFamily: ReadonlyMap<string, readonly PoolEntry[]>,
): PoolEntry[] {
  const queues = [...byFamily].map(([, entries]) => ({
    entries: [...entries],
    weight: entries.length,
    credit: 0,
  }));
  const total = queues.reduce((sum, queue) => sum + queue.weight, 0);
  const interleaved: PoolEntry[] = [];
  while (interleaved.length < total) {
    for (const queue of queues) {
      queue.credit += queue.weight;
    }
    const chosen = queues
      .filter((queue) => queue.entries.length > 0)
      .reduce((best, queue) => (queue.credit > best.credit ? queue : best));
    chosen.credit -= total;
    interleaved.push(chosen.entries.shift()!);
  }
  const sorted = interleaved
    .map((entry) => entry[1])
    .sort((left, right) => left - right);
  const median = sorted[Math.floor((sorted.length - 1) / 2)]!;
  const isNew = (entry: PoolEntry) =>
    findHakoiriMusumeFamily(entry[5] ?? CLASSIC_FAMILY).introducedAtLevel ===
      Number(level) && entry[5] !== CLASSIC_FAMILY;
  const arranged: PoolEntry[] = [];
  const rest = [...interleaved];
  for (let position = 0; position < SHORT_PROBLEMS_FIRST; position += 1) {
    const index = rest.findIndex(
      (entry) =>
        entry[1] <= median && (position >= INTRODUCTION_HOLD || !isNew(entry)),
    );
    if (index === -1) {
      break;
    }
    arranged.push(...rest.splice(index, 1));
  }
  return [...arranged, ...rest];
}

function percentiles(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const at = (ratio: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(ratio * sorted.length))];
  return {
    min: at(0),
    p25: at(0.25),
    median: sorted[Math.floor((sorted.length - 1) / 2)],
    p75: at(0.75),
    max: at(1),
  };
}

/** 別のプロセスで族ごとに並べて走らせる。 */
function prepareFamily(familyId: string, seed: string, cacheDirectory: string) {
  const supply = new FamilySupply(
    findHakoiriMusumeFamily(familyId),
    seed,
    cacheDirectory,
  );
  for (const level of difficulties) {
    const count = allocate(level).get(familyId);
    if (count !== undefined) {
      supply.ensure(level, count);
    }
  }
}

/**
 * 娘が2人の族と大きい盤の族は重いので先に回す。
 * 基準の盤の問題の確かめは、このプロセスで同時に進める。
 */
async function prepareFamiliesInParallel(seed: string, cacheDirectory: string) {
  const queue = hakoiriMusumeFamilies
    .filter((family) => family.id !== CLASSIC_FAMILY)
    .sort(
      (left, right) =>
        right.targets.length - left.targets.length ||
        right.columns * right.rows - left.columns * left.rows,
    )
    .map((family) => family.id);
  const runOne = async (): Promise<void> => {
    const familyId = queue.shift();
    if (familyId === undefined) {
      return;
    }
    const child = Bun.spawn(
      [
        "bun",
        import.meta.filename,
        "--prepare-family",
        familyId,
        "--seed",
        seed,
        "--cache",
        cacheDirectory,
      ],
      { stdout: "inherit", stderr: "inherit" },
    );
    if ((await child.exited) !== 0) {
      throw new Error(`Preparing ${familyId} failed`);
    }
    await runOne();
  };
  return Promise.all(Array.from({ length: PARALLEL_FAMILIES }, runOne));
}

async function generate(seed: string, cacheDirectory: string) {
  mkdirSync(cacheDirectory, { recursive: true });
  const started = performance.now();
  const prepared = prepareFamiliesInParallel(seed, cacheDirectory);
  const classic = confirmClassicProblems();
  await prepared;
  console.error(
    `classic confirmed ${difficulties.map((level) => classic[level].length).join("/")}`,
  );
  const supplies = new Map(
    hakoiriMusumeFamilies
      .filter((family) => family.id !== CLASSIC_FAMILY)
      .map((family) => [
        family.id,
        new FamilySupply(family, seed, cacheDirectory),
      ]),
  );
  const takeFrom = (
    id: string,
    level: HakoiriMusumeDifficulty,
    count: number,
  ) => {
    if (id === CLASSIC_FAMILY) {
      const taken: PoolEntry[] = [];
      for (const entry of classic[level]) {
        if (taken.length >= count) {
          break;
        }
        if (hasNoSuperfluousPiece(entry)) {
          taken.push(entry);
        }
      }
      return taken;
    }
    const supply = supplies.get(id)!;
    supply.ensure(level, count);
    return supply.take(level, count);
  };
  const levels = {} as Record<HakoiriMusumeDifficulty, PoolEntry[]>;
  const counts: Record<string, Record<string, number>> = {};
  for (const level of difficulties) {
    const wanted = allocate(level);
    const byFamily = new Map<string, PoolEntry[]>();
    let shortfall = 0;
    for (const [id, count] of wanted) {
      byFamily.set(id, takeFrom(id, level, count));
      shortfall += count - byFamily.get(id)!.length;
    }
    // 足りない分は、同じレベルの割合の大きい族から足す。
    for (const [id] of [...wanted].sort((a, b) => b[1] - a[1])) {
      if (shortfall === 0) {
        break;
      }
      const have = byFamily.get(id)!.length;
      const taken = takeFrom(id, level, have + shortfall);
      shortfall -= taken.length - have;
      byFamily.set(id, taken);
    }
    levels[level] = arrangeLevel(level, byFamily);
    counts[level] = Object.fromEntries(
      [...byFamily].map(([id, entries]) => [id, entries.length]),
    );
  }
  const active = new Set(
    difficulties.flatMap((level) => levels[level].map((entry) => entry[0])),
  );
  const retired = Object.fromEntries(
    difficulties.map((level) => [
      level,
      classicLevels[level].filter(([board]) => !active.has(board)),
    ]),
  ) as ClassicLevels;
  const pool: HakoiriMusumeProblemPool = {
    generatorVersion: "1",
    levels,
    retired,
  };
  writeFileSync(poolPath, `${JSON.stringify(pool)}\n`);
  console.log(
    JSON.stringify(
      {
        seconds: Math.round((performance.now() - started) / 1000),
        families: counts,
        optimalMoveCount: Object.fromEntries(
          difficulties.map((level) => [
            level,
            percentiles(levels[level].map((entry) => entry[1])),
          ]),
        ),
        optimalMoveCountByFamily: Object.fromEntries(
          difficulties.map((level) => [
            level,
            Object.fromEntries(
              [...new Set(levels[level].map((entry) => entry[5]))].map((id) => [
                id,
                percentiles(
                  levels[level]
                    .filter((entry) => entry[5] === id)
                    .map((entry) => entry[1]),
                ),
              ]),
            ),
          ]),
        ),
        analyzedPieceSets: Object.fromEntries(
          [...supplies].map(([id, supply]) => [
            id,
            {
              pieceSets: supply.results.length,
              tooLarge: supply.results.filter(
                (result) => result.status === "too-large",
              ).length,
              states: supply.results.reduce(
                (sum, result) => sum + result.states,
                0,
              ),
              superfluousUnknownTaken: supply.results.reduce(
                (sum, result) =>
                  sum + (result.rejected["superfluous-unknown-taken"] ?? 0),
                0,
              ),
            },
          ]),
        ),
        classicConfirmed: Object.fromEntries(
          difficulties.map((level) => [level, classic[level].length]),
        ),
        retired: Object.fromEntries(
          difficulties.map((level) => [level, retired[level].length]),
        ),
      },
      null,
      1,
    ),
  );
}

/**
 * 今の問題集の全問を分析し直し、値・レベル・正規形の確かめが合うことと、件数と盤面の重なりを確かめる。同じ族・同じ駒の組・同じ
 * 連結成分の問題は1回の分析で確かめる。
 */
function verify() {
  const pool = JSON.parse(
    readFileSync(poolPath, "utf8"),
  ) as HakoiriMusumeProblemPool;
  const failures: string[] = [];
  const boards = new Set<string>();
  const prepared = difficulties.flatMap((level) => {
    const entries = pool.levels[level];
    if (entries.length !== hakoiriMusumeMix.problemsPerLevel) {
      failures.push(`level ${level}: ${entries.length} problems`);
    }
    return entries.map((entry) => {
      if (boards.has(entry[0])) {
        failures.push(`${entry[0]}: duplicated`);
      }
      boards.add(entry[0]);
      const { problem } = restoreHakoiriMusumeProblem(
        createHakoiriMusumeProblemIdentity(entry[0]),
      );
      const { space, start } = createHakoiriMusumeProblemSpace(
        problem.layout,
        problem.pieces,
      );
      const group = `${entry[5] ?? CLASSIC_FAMILY}:${JSON.stringify(space.spec.types)}`;
      return { level, entry, problem, space, start, group };
    });
  });
  const verified = new Set<string>();
  for (const first of prepared) {
    if (verified.has(first.entry[0])) {
      continue;
    }
    if (countHakoiriMusumeCells(first.problem.layout) > 32) {
      failures.push(`${first.entry[0]}: board too large`);
      verified.add(first.entry[0]);
      continue;
    }
    const graph = createHakoiriMusumeGeneralGraph(first.space, [first.start])!;
    const measures = measureHakoiriMusumeGeneralGraph(graph);
    for (const other of prepared) {
      const state =
        other.group === first.group
          ? graph.indexByKey.get(other.start)
          : undefined;
      if (state === undefined || verified.has(other.entry[0])) {
        continue;
      }
      verified.add(other.entry[0]);
      const [
        board,
        optimal,
        preparation,
        detour,
        shortestPreparation,
        familyId,
      ] = other.entry;
      const family = findHakoiriMusumeFamily(familyId ?? CLASSIC_FAMILY);
      const actual = [
        measures.optimal[state],
        measures.preparation[state],
        measures.detour[state],
        measures.shortestPreparation[state],
      ];
      if (
        actual.join() !==
        [optimal, preparation, detour, shortestPreparation].join()
      ) {
        failures.push(`${board}: values ${actual.join()}`);
      }
      const assessment = classifyHakoiriMusumeFeatures({
        optimalMoveCount: measures.optimal[state]!,
        preparationLength: measures.preparation[state]! + family.levelOffset,
        daughterDetourCount: measures.detour[state]!,
        emptyCellCount: countHakoiriMusumeProblemEmptyCells(other.problem),
        shortestPreparationLength: measures.shortestPreparation[state]!,
      });
      if (
        assessment.status !== "classified" ||
        assessment.difficulty !== other.level
      ) {
        failures.push(`${board}: assessed ${JSON.stringify(assessment)}`);
      }
      if (confirmHakoiriMusumeNormalForm(graph, measures, state) === null) {
        failures.push(`${board}: no normal-form witness`);
      }
    }
    console.error(`verified ${verified.size}`);
  }
  const classicChecked = verifyClassicPoolValues(failures);
  verifyDesignExamples(failures);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(
    `verified ${verified.size} problems and ${classicChecked} previous classic problems`,
  );
}

/** 設計の解析器で数えた、広げた盤の作りの例の最短手数・準備の長さ・遠回り。 */
const designExamples = [
  ["4x5;Babb/AA.c/AAdd/.ee./ffgg;bottom1-2@3.1;top0-0@0.0", [30, 20, 2]],
  ["4x5;.ab./caAA/deAA/feeg/h.ig;bottom1-2@3.1", [30, 18, 1]],
  ["4x5;a.b./AAcc/AAdd/effg/hh.g;right1-2@1.2", [30, 24, 2]],
] as const;

function verifyDesignExamples(failures: string[]) {
  for (const [seed, expected] of designExamples) {
    const { problem } = restoreHakoiriMusumeProblem(
      createHakoiriMusumeProblemIdentity(seed),
    );
    const { space, start } = createHakoiriMusumeProblemSpace(
      problem.layout,
      problem.pieces,
    );
    const measures = measureHakoiriMusumeGeneralGraph(
      createHakoiriMusumeGeneralGraph(space, [start])!,
    );
    const actual = [
      measures.optimal[0],
      measures.preparation[0],
      measures.detour[0],
    ];
    if (actual.join() !== expected.join()) {
      failures.push(`${seed}: design example values ${actual.join()}`);
    }
  }
  console.error(`verified ${designExamples.length} design examples`);
}

/**
 * 前の問題集の基準の盤の問題の最短手数・準備の長さ・遠回り・最短の解の準備が、今の物差しの値と一致するかを確かめる。
 * 引き継いだ問題の記録は前の値で残っているので、物差しを変えても値が変わらないことを保つ。
 */
function verifyClassicPoolValues(failures: string[]): number {
  const pending = difficulties
    .flatMap((level) => classicLevels[level])
    .map((entry) => {
      const { problem } = restoreHakoiriMusumeProblem(
        createHakoiriMusumeProblemIdentity(entry[0]),
      );
      const { space, start } = createHakoiriMusumeProblemSpace(
        problem.layout,
        problem.pieces,
      );
      return { entry, space, start, group: JSON.stringify(space.spec.types) };
    });
  const checked = new Set<string>();
  for (const first of pending) {
    if (checked.has(first.entry[0])) {
      continue;
    }
    const graph = createHakoiriMusumeGeneralGraph(first.space, [first.start])!;
    const measures = measureHakoiriMusumeGeneralGraph(graph);
    for (const other of pending) {
      const state =
        other.group === first.group
          ? graph.indexByKey.get(other.start)
          : undefined;
      if (state === undefined || checked.has(other.entry[0])) {
        continue;
      }
      checked.add(other.entry[0]);
      const [board, optimal, preparation, detour, shortestPreparation] =
        other.entry;
      const actual = [
        measures.optimal[state],
        measures.preparation[state],
        measures.detour[state],
        measures.shortestPreparation[state],
      ];
      if (
        actual.join() !==
        [optimal, preparation, detour, shortestPreparation].join()
      ) {
        failures.push(`${board}: previous classic values ${actual.join()}`);
      }
    }
  }
  if (checked.size !== pending.length) {
    failures.push(
      `previous classic problems: ${checked.size} of ${pending.length} checked`,
    );
  }
  console.error(`verified ${checked.size} previous classic problems`);
  return checked.size;
}

const { values } = parseArgs({
  options: {
    seed: { type: "string", default: defaultSeed },
    cache: { type: "string", default: defaultCacheDirectory },
    verify: { type: "boolean", default: false },
    "prepare-family": { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(formatUsage());
} else if (values.verify) {
  verify();
} else if (values["prepare-family"]) {
  prepareFamily(values["prepare-family"], values.seed, values.cache);
} else {
  await generate(values.seed, values.cache);
}
