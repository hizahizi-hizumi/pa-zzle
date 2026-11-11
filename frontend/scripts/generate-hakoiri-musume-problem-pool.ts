import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";

import { difficultyLevels } from "@/games/difficulty";
import {
  classifyHakoiriMusumeFeatures,
  type HakoiriMusumeDifficulty,
  hakoiriMusumeLevelCriteria,
  hakoiriMusumeOptimalMoveCountRange,
} from "@/games/hakoiri-musume/difficulty";
import { HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT } from "@/games/hakoiri-musume/problem/daughter-detour";
import type { HakoiriMusumeDifficultyFeatures } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  type HakoiriMusumeNaivePlayKind,
  hakoiriMusumeNaivePlayKinds,
  playHakoiriMusumeNaively,
} from "@/games/hakoiri-musume/problem/generation/naive-play";
import {
  analyzeHakoiriMusumePieceSet,
  formatHakoiriMusumePieceSet,
  HAKOIRI_MUSUME_MERGE_SHARE,
  HAKOIRI_MUSUME_NEAR_MOVE_COUNT,
  type HakoiriMusumeCandidate,
  hakoiriMusumeLevelSelections,
  hakoiriMusumePieceSets,
  interleaveHakoiriMusumeProblems,
  listHakoiriMusumeCandidates,
  measureHakoiriMusumeSetupRun,
  pickHakoiriMusumePieceSetProblems,
  readHakoiriMusumeStartShape,
} from "@/games/hakoiri-musume/problem/generation/pool-selection";
import {
  findHakoiriMusumeSimplePreparationPath,
  keepsHakoiriMusumePreparationWhenMerged,
  measureHakoiriMusumePathPreparation,
} from "@/games/hakoiri-musume/problem/generation/simple-witness";
import {
  countHakoiriMusumePieceSet,
  type HakoiriMusumePieceSet,
  type HakoiriMusumeStateGraph,
  mirrorHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/problem/generation/state-space";
import { HAKOIRI_MUSUME_GENERATOR_VERSION } from "@/games/hakoiri-musume/problem/problem";
import type {
  HakoiriMusumeProblemPool,
  HakoiriMusumeProblemPoolEntry,
} from "@/games/hakoiri-musume/problem/problem-pool";
import {
  createProblemSeededRandom,
  hashProblemSeed,
  shuffleProblemValues,
} from "@/games/problem-seed";

function formatUsage(): string {
  return `Usage: bun run generate:hakoiri-musume-pool -- [options]

駒の組（82組）ごとに全局面を数え上げて分類し、レベルごとに近い問題を除いて採り、駒の組を seed で並べ替えた順に
1問ずつ巡回して並べる。駒の組ごとの結果はキャッシュに書き、途中で止めても続きから作り直せる。

Options:
  --seed <seed>     並べ替えの seed (default: ${defaultSeed})
  --cache <dir>     駒の組ごとの結果を置くディレクトリ (default: ${defaultCacheDirectory})
  --verify          問題集を書かず、今の問題集の全問を分析し直して、レベル・最短手数・準備の長さと、近い問題が無いことを確かめる`;
}

const defaultSeed = "20261104";
const defaultCacheDirectory = path.join(tmpdir(), "hakoiri-musume-pool-cache");

/**
 * レベルごとの問題数の目安と下限。目安まで採れなければ、下限以上の採れただけを問題集にする。
 * レベル5 は、娘が上の2段から始まり、1つの連結成分から 25 問までに絞ると約 220 問しか採れないので、ほかのレベルより少なくする。
 */
const problemCountByDifficulty = {
  "1": { target: 500, minimum: 400 },
  "2": { target: 500, minimum: 400 },
  "3": { target: 500, minimum: 400 },
  "4": { target: 500, minimum: 400 },
  "5": { target: 200, minimum: 150 },
} as const satisfies Record<
  HakoiriMusumeDifficulty,
  { target: number; minimum: number }
>;

const outputPath = new URL(
  "../src/games/hakoiri-musume/problem/problem-pool.json",
  import.meta.url,
);

type Histogram = Record<string, number>;

/** 素朴な解き方を当てた1問の、最短手数と、解き方ごと・試行ごとの解けた手数（解けなければ `null`）。 */
type NaivePlayRecord = {
  optimalMoveCount: number;
  results: Record<HakoiriMusumeNaivePlayKind, (number | null)[]>;
};

/** 素朴な解き方（検査 D1）を当てる、駒の組・レベルごとの問題数と、1問あたりの試行の数、打ち切りの手数。 */
const naivePlayProblemsPerSet = 8;
const naivePlayTrials = 3;
const naivePlayBudget = 1000;

/** 駒の組1つの結果。分類の状態の数、レベルごとの全候補の特徴の分布と、採った問題（seed の順）。 */
/** 採った問題と、問題集の分布を確かめるための値。`componentSize` はその問題の連結成分の盤面の数、`setupRun` は段取りの長さ。 */
type PickedProblem = HakoiriMusumeCandidate & {
  component: number;
  componentSize: number;
  setupRun: number;
};

type PieceSetResult = {
  pieceSet: HakoiriMusumePieceSet;
  stateCount: number;
  candidateCount: number;
  statusCounts: Histogram;
  classifiedFeatureHistograms: Record<
    HakoiriMusumeDifficulty,
    Record<keyof HakoiriMusumeDifficultyFeatures, Histogram>
  >;
  /** レベルごとの全候補の、準備の長さが作業の量の言い換えになっている問題の数え上げ（検査 A5、`tallyWorkloadRestatement`）。 */
  classifiedWorkloadTallies: Record<HakoiriMusumeDifficulty, Histogram>;
  picked: Record<HakoiriMusumeDifficulty, PickedProblem[]>;
  /** 輪の無い解で準備の長さを確かめられずに採らなかった候補の数。 */
  witnessRejections: Record<HakoiriMusumeDifficulty, number>;
  naivePlays: Record<HakoiriMusumeDifficulty, NaivePlayRecord[]>;
  elapsedMs: number;
};

const featureKeys = [
  "optimalMoveCount",
  "preparationLength",
  "shortestPreparationLength",
  "daughterDetourCount",
  "emptyCellCount",
  "lureCount",
  "daughterMoveCount",
  "optimalFirstMoveCount",
  "firstMoveCount",
] as const satisfies readonly (keyof HakoiriMusumeDifficultyFeatures)[];

function createLevelRecord<T>(
  create: () => T,
): Record<HakoiriMusumeDifficulty, T> {
  return {
    "1": create(),
    "2": create(),
    "3": create(),
    "4": create(),
    "5": create(),
  };
}

function addTo(histogram: Histogram, key: string | number, count = 1) {
  histogram[key] = (histogram[key] ?? 0) + count;
}

function processPieceSet(
  pieceSet: HakoiriMusumePieceSet,
  seed: string,
): PieceSetResult {
  const startedAt = performance.now();
  const space = analyzeHakoiriMusumePieceSet(pieceSet);
  const candidates = listHakoiriMusumeCandidates(space, seed);
  const statusCounts: Histogram = {};
  const classifiedFeatureHistograms = createLevelRecord(
    () =>
      Object.fromEntries(featureKeys.map((key) => [key, {}])) as Record<
        keyof HakoiriMusumeDifficultyFeatures,
        Histogram
      >,
  );
  const classifiedWorkloadTallies = createLevelRecord<Histogram>(() => ({}));
  for (const { assessment, features } of candidates) {
    if (assessment.status === "classified") {
      addTo(statusCounts, assessment.difficulty);
      tallyWorkloadRestatement(
        classifiedWorkloadTallies[assessment.difficulty],
        features,
      );
      for (const key of featureKeys) {
        addTo(
          classifiedFeatureHistograms[assessment.difficulty][key],
          features[key],
        );
      }
    } else {
      addTo(
        statusCounts,
        assessment.status === "out-of-range"
          ? assessment.reason
          : assessment.status,
      );
    }
  }
  const { picked: pickedCandidates, witnessRejections } =
    pickHakoiriMusumePieceSetProblems(
      space,
      candidates,
      seed,
      Math.max(
        ...Object.values(problemCountByDifficulty).map(({ target }) => target),
      ),
    );
  const componentSizes = new Map<number, number>();
  for (const component of space.components) {
    componentSizes.set(component, (componentSizes.get(component) ?? 0) + 1);
  }
  const picked = createLevelRecord<PickedProblem[]>(() => []);
  for (const { id: difficulty } of difficultyLevels) {
    picked[difficulty] = pickedCandidates[difficulty].map((candidate) => ({
      ...candidate,
      component: space.components[candidate.index]!,
      componentSize: componentSizes.get(space.components[candidate.index]!)!,
      setupRun: measureHakoiriMusumeSetupRun(space, candidate.index),
    }));
  }
  const naivePlays = createLevelRecord<NaivePlayRecord[]>(() => []);
  const random = createProblemSeededRandom(
    `${seed}:naive:${formatHakoiriMusumePieceSet(pieceSet)}`,
  );
  for (const { id: difficulty } of difficultyLevels) {
    for (const { index, features } of picked[difficulty].slice(
      0,
      naivePlayProblemsPerSet,
    )) {
      const results = Object.fromEntries(
        hakoiriMusumeNaivePlayKinds.map((kind) => [
          kind,
          Array.from({ length: naivePlayTrials }, () =>
            playHakoiriMusumeNaively(
              kind,
              space.graph,
              index,
              random,
              naivePlayBudget,
            ),
          ),
        ]),
      ) as NaivePlayRecord["results"];
      naivePlays[difficulty].push({
        optimalMoveCount: features.optimalMoveCount,
        results,
      });
    }
  }
  return {
    pieceSet,
    stateCount: space.graph.boards.length,
    candidateCount: candidates.length,
    statusCounts,
    classifiedFeatureHistograms,
    classifiedWorkloadTallies,
    picked,
    witnessRejections,
    naivePlays,
    elapsedMs: Math.round(performance.now() - startedAt),
  };
}

/**
 * 採否と特徴を決めるモジュール。内容をキャッシュの鍵に含め、数え方や分類を変えたら古い結果を使わずに作り直す。
 */
const selectionSourcePaths = [
  "../src/games/hakoiri-musume/difficulty.ts",
  "../src/games/hakoiri-musume/puzzle/board.ts",
  "../src/games/hakoiri-musume/problem/daughter-detour.ts",
  "../src/games/hakoiri-musume/problem/difficulty-analysis.ts",
  "../src/games/hakoiri-musume/problem/generation/naive-play.ts",
  "../src/games/hakoiri-musume/problem/generation/pool-selection.ts",
  "../src/games/hakoiri-musume/problem/generation/simple-witness.ts",
  "../src/games/hakoiri-musume/problem/generation/state-space.ts",
] as const;

const selectionRuleKey = hashProblemSeed(
  JSON.stringify({
    sources: selectionSourcePaths.map((sourcePath) =>
      hashProblemSeed(
        readFileSync(new URL(sourcePath, import.meta.url), "utf8"),
      ),
    ),
    criteria: hakoiriMusumeLevelCriteria,
    optimalMoveCountRange: hakoiriMusumeOptimalMoveCountRange,
    nearMoveCount: HAKOIRI_MUSUME_NEAR_MOVE_COUNT,
    mergeShare: HAKOIRI_MUSUME_MERGE_SHARE,
    limit: Math.max(
      ...Object.values(problemCountByDifficulty).map(({ target }) => target),
    ),
    naivePlay: [naivePlayProblemsPerSet, naivePlayTrials, naivePlayBudget],
  }),
).toString(36);

function readOrProcess(
  pieceSet: HakoiriMusumePieceSet,
  seed: string,
  cacheDirectory: string,
): PieceSetResult {
  const cachePath = path.join(
    cacheDirectory,
    `${HAKOIRI_MUSUME_GENERATOR_VERSION}-${selectionRuleKey}-${seed}-${formatHakoiriMusumePieceSet(pieceSet)}.json`,
  );
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8")) as PieceSetResult;
  }
  const result = processPieceSet(pieceSet, seed);
  writeFileSync(cachePath, JSON.stringify(result));
  console.error(
    `${formatHakoiriMusumePieceSet(pieceSet)}: ${result.stateCount} states, ${result.elapsedMs}ms`,
  );
  return result;
}

/** 最小 / 10 / 50 / 90 / 最大 パーセンタイル。 */
function listPercentiles(histogram: Histogram): number[] {
  const values = Object.entries(histogram)
    .map(([value, count]) => [Number(value), count] as const)
    .sort((left, right) => left[0] - right[0]);
  const total = values.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) {
    return [];
  }
  return [0, 10, 50, 90, 100].map((percent) => {
    const threshold =
      percent === 0 ? 1 : Math.max(1, Math.ceil((total * percent) / 100));
    let accumulated = 0;
    for (const [value, count] of values) {
      accumulated += count;
      if (accumulated >= threshold) {
        return value;
      }
    }
    return values.at(-1)![0];
  });
}

function orderPieceSets(seed: string): HakoiriMusumePieceSet[] {
  return shuffleProblemValues(
    hakoiriMusumePieceSets,
    createProblemSeededRandom(`${seed}:piece-sets`),
  );
}

/**
 * 準備の長さが作業の量の言い換えになっている問題を数える（検査 A5）。`shortestUndivided` は最短の解で数えた準備の長さ =
 * 最短手数 − 1（最短の解が1つの区間だけ）、`highShare` は準備の長さが最短手数の 9 割以上、`shareSum` は準備の長さ ÷ 最短手数の和。
 */
function tallyWorkloadRestatement(
  tally: Histogram,
  {
    optimalMoveCount,
    preparationLength,
    shortestPreparationLength,
  }: HakoiriMusumeDifficultyFeatures,
) {
  const share = preparationLength / optimalMoveCount;
  addTo(tally, "count");
  addTo(
    tally,
    "shortestUndivided",
    shortestPreparationLength === optimalMoveCount - 1 ? 1 : 0,
  );
  addTo(tally, "highShare", share >= 0.9 ? 1 : 0);
  addTo(tally, "shareSum", share);
}

function summarizeWorkloadRestatement(tally: Histogram) {
  const count = Math.max(tally.count ?? 0, 1);
  const ratio = (key: string) =>
    Math.round(((tally[key] ?? 0) / count) * 1000) / 1000;
  return {
    shortestUndivided: ratio("shortestUndivided"),
    highShare: ratio("highShare"),
    meanShare: ratio("shareSum"),
  };
}

/**
 * 最短手数を10手ごとの層に分けた、分類された全候補のレベルの割合（検査 A5。作業の量をそろえた層の中でもレベルが分かれるか）。
 */
function summarizeLevelSharesByOptimalMoveCount(
  results: readonly PieceSetResult[],
) {
  const byBin: Record<string, Histogram> = {};
  for (const result of results) {
    for (const { id: difficulty } of difficultyLevels) {
      for (const [optimal, count] of Object.entries(
        result.classifiedFeatureHistograms[difficulty].optimalMoveCount,
      )) {
        const bin = Math.floor(Number(optimal) / 10) * 10;
        addTo((byBin[`${bin}-${bin + 9}`] ??= {}), difficulty, count);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(byBin)
      .sort(
        ([left], [right]) =>
          Number.parseInt(left, 10) - Number.parseInt(right, 10),
      )
      .map(([bin, histogram]) => {
        const total = Object.values(histogram).reduce(
          (sum, value) => sum + value,
          0,
        );
        return [
          bin,
          Object.fromEntries(
            Object.entries(histogram).map(([difficulty, count]) => [
              difficulty,
              Math.round((count / total) * 1000) / 1000,
            ]),
          ),
        ];
      }),
  );
}

/** 問題集の並び（図鑑の番号の順）の始めに置く、レベルの中で短い問題の数。 */
const shortProblemsInFront = 30;

/**
 * 問題集の並びの始めに、最短手数がレベルの中央値以下の問題を `shortProblemsInFront` 問置く。図鑑で順に開く人の最初の問題が、
 * そのレベルの重い側にならないようにする。置く問題とほかの問題は、それぞれ元の並びの順を保つ。ランダムに遊ぶ問題の選び方は
 * 並びに依らないので変わらない。
 */
function bringShortProblemsForward<
  Problem extends { features: { optimalMoveCount: number } },
>(problems: readonly Problem[]): Problem[] {
  const counts = problems
    .map(({ features }) => features.optimalMoveCount)
    .sort((left, right) => left - right);
  const median = counts[Math.floor((counts.length - 1) / 2)] ?? 0;
  const front = problems
    .filter(({ features }) => features.optimalMoveCount <= median)
    .slice(0, shortProblemsInFront);
  const inFront = new Set(front);
  return [...front, ...problems.filter((problem) => !inFront.has(problem))];
}

function generate(seed: string, cacheDirectory: string) {
  mkdirSync(cacheDirectory, { recursive: true });
  const results = orderPieceSets(seed).map((pieceSet) =>
    readOrProcess(pieceSet, seed, cacheDirectory),
  );
  const levels = createLevelRecord<HakoiriMusumeProblemPoolEntry[]>(() => []);
  const statistics: Record<string, unknown> = {};
  for (const { id: difficulty } of difficultyLevels) {
    const { target, minimum } = problemCountByDifficulty[difficulty];
    const problems = bringShortProblemsForward(
      interleaveHakoiriMusumeProblems(
        results.map(({ picked }) => picked[difficulty]),
        target,
      ),
    );
    if (problems.length < minimum) {
      throw new Error(
        `Level ${difficulty} has only ${problems.length} of ${minimum} problems`,
      );
    }
    levels[difficulty] = problems.map(({ board, features }) => [
      board,
      features.optimalMoveCount,
      features.preparationLength,
      features.daughterDetourCount,
      features.shortestPreparationLength,
    ]);
    const pooledHistograms = Object.fromEntries(
      featureKeys.map((key) => {
        const histogram: Histogram = {};
        for (const { features } of problems) {
          addTo(histogram, features[key]);
        }
        return [key, listPercentiles(histogram)];
      }),
    );
    const setShares: Histogram = {};
    const byEmpty: Record<string, Histogram[]> = {};
    for (const { board, features } of problems) {
      addTo(
        setShares,
        formatHakoiriMusumePieceSet(countHakoiriMusumePieceSet(board)),
      );
      const group = (byEmpty[features.emptyCellCount] ??= [{}, {}, {}]);
      addTo(group[0]!, features.optimalMoveCount);
      addTo(group[1]!, features.preparationLength);
      addTo(group[2]!, features.daughterDetourCount);
    }
    const allClassified: Histogram = {};
    for (const result of results) {
      const histogram =
        result.classifiedFeatureHistograms[difficulty].optimalMoveCount;
      for (const [value, valueCount] of Object.entries(histogram)) {
        addTo(allClassified, value, valueCount);
      }
    }
    const classifiedTally: Histogram = {};
    for (const result of results) {
      for (const [key, value] of Object.entries(
        result.classifiedWorkloadTallies[difficulty],
      )) {
        addTo(classifiedTally, key, value);
      }
    }
    const pooledTally: Histogram = {};
    for (const { features } of problems) {
      tallyWorkloadRestatement(pooledTally, features);
    }
    const naivePlays = results.flatMap(
      ({ naivePlays }) => naivePlays[difficulty],
    );
    const naiveSummary = Object.fromEntries(
      hakoiriMusumeNaivePlayKinds.map((kind) => {
        const trials = naivePlays.flatMap(({ optimalMoveCount, results }) =>
          results[kind].map((steps) => ({ optimalMoveCount, steps })),
        );
        const solved = trials.filter(({ steps }) => steps !== null);
        const ratios = solved
          .map(({ optimalMoveCount, steps }) => steps! / optimalMoveCount)
          .sort((left, right) => left - right);
        return [
          kind,
          {
            trials: trials.length,
            solvedWithinThreeTimesOptimal:
              trials.filter(
                ({ optimalMoveCount, steps }) =>
                  steps !== null && steps <= 3 * optimalMoveCount,
              ).length / trials.length,
            solvedWithinBudget: solved.length / trials.length,
            medianRatioWhenSolved:
              ratios[Math.floor(ratios.length / 2)] ?? null,
          },
        ];
      }),
    );
    const shapeHistograms = {
      daughterRow: {} as Histogram,
      smallCount: {} as Histogram,
      tidiness: {} as Histogram,
      componentSize: {} as Histogram,
      setupRun: {} as Histogram,
    };
    const problemsByComponent: Histogram = {};
    let shortestShareAbove80 = 0;
    let shortestShareAbove85 = 0;
    for (const {
      board,
      features,
      component,
      componentSize,
      setupRun,
    } of problems) {
      const shape = readHakoiriMusumeStartShape(board);
      addTo(shapeHistograms.daughterRow, shape.daughterRow);
      addTo(shapeHistograms.smallCount, shape.smallCount);
      addTo(shapeHistograms.tidiness, shape.tidiness);
      addTo(shapeHistograms.componentSize, componentSize);
      addTo(shapeHistograms.setupRun, setupRun);
      addTo(
        problemsByComponent,
        `${formatHakoiriMusumePieceSet(countHakoiriMusumePieceSet(board))}:${component}`,
      );
      const share =
        features.shortestPreparationLength / features.optimalMoveCount;
      shortestShareAbove80 += share > 0.8 ? 1 : 0;
      shortestShareAbove85 += share >= 0.85 ? 1 : 0;
    }
    statistics[difficulty] = {
      naivePlay: { problems: naivePlays.length, ...naiveSummary },
      witnessRejections: results.reduce(
        (sum, { witnessRejections }) => sum + witnessRejections[difficulty],
        0,
      ),
      selection: hakoiriMusumeLevelSelections[difficulty],
      startShape: Object.fromEntries(
        Object.entries(shapeHistograms).map(([key, histogram]) => [
          key,
          listPercentiles(histogram),
        ]),
      ),
      daughterRowCounts: shapeHistograms.daughterRow,
      components: {
        used: Object.keys(problemsByComponent).length,
        largestShare:
          Math.round(
            (Math.max(...Object.values(problemsByComponent)) /
              problems.length) *
              1000,
          ) / 1000,
        maximumProblems: Math.max(...Object.values(problemsByComponent)),
      },
      longShare: {
        atLeast55:
          problems.filter(({ features }) => features.optimalMoveCount >= 55)
            .length / problems.length,
        atLeast70:
          problems.filter(({ features }) => features.optimalMoveCount >= 70)
            .length / problems.length,
      },
      shortestPreparationShare: {
        above80:
          Math.round((shortestShareAbove80 / problems.length) * 1000) / 1000,
        atLeast85:
          Math.round((shortestShareAbove85 / problems.length) * 1000) / 1000,
      },
      pooled: problems.length,
      classifiedCandidates: Object.values(allClassified).reduce(
        (sum, value) => sum + value,
        0,
      ),
      availableAfterNearFilter: results.reduce(
        (sum, { picked }) => sum + picked[difficulty].length,
        0,
      ),
      workloadRestatement: {
        classifiedCandidates: summarizeWorkloadRestatement(classifiedTally),
        pooled: summarizeWorkloadRestatement(pooledTally),
      },
      pieceSetsUsed: Object.keys(setShares).length,
      topPieceSetShare:
        Math.round(
          (Math.max(...Object.values(setShares)) / problems.length) * 1000,
        ) / 1000,
      percentiles: pooledHistograms,
      medianByEmptyCellCount: Object.fromEntries(
        Object.entries(byEmpty).map(
          ([empty, [optimal, preparation, detour]]) => [
            empty,
            [optimal!, preparation!, detour!].map(
              (histogram) => listPercentiles(histogram)[2],
            ),
          ],
        ),
      ),
    };
  }
  const statusTotals: Histogram = {};
  for (const { statusCounts } of results) {
    for (const [status, count] of Object.entries(statusCounts)) {
      addTo(statusTotals, status, count);
    }
  }
  const levelSharesByOptimalMoveCount =
    summarizeLevelSharesByOptimalMoveCount(results);
  const pool: HakoiriMusumeProblemPool = {
    generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
    levels,
  };
  const json = `${JSON.stringify(pool)}\n`;
  writeFileSync(outputPath, json);
  console.log(
    JSON.stringify(
      {
        seed,
        states: results.reduce((sum, { stateCount }) => sum + stateCount, 0),
        candidates: results.reduce(
          (sum, { candidateCount }) => sum + candidateCount,
          0,
        ),
        statusTotals,
        levels: statistics,
        levelSharesByOptimalMoveCount,
        bytes: Buffer.byteLength(json),
        gzipBytes: gzipSync(json).byteLength,
      },
      null,
      1,
    ),
  );
}

/** 盤面 `start` から `limit` 手以内で行ける盤面（生成の近い問題の印とは別に、印に関わらずたどる）。 */
function listBoardsWithinMoves(
  graph: HakoiriMusumeStateGraph,
  start: number,
  limit: number,
): Set<number> {
  const reached = new Set([start]);
  let frontier = [start];
  for (let step = 0; step < limit; step += 1) {
    const next: number[] = [];
    for (const current of frontier) {
      for (
        let edge = graph.edgeStarts[current]!;
        edge < graph.edgeStarts[current + 1]!;
        edge += 1
      ) {
        const neighbor = graph.edges[edge]!;
        if (!reached.has(neighbor)) {
          reached.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return reached;
}

/** 盤面 `start` の最短解の上にある盤面を、最短手数の大きい順（`start` に近い順）の層に分けて返す。 */
function listShortestDescendantLayers(
  graph: HakoiriMusumeStateGraph,
  optimal: Int32Array,
  start: number,
): number[][] {
  const layers = [[start]];
  const seen = new Set([start]);
  while (optimal[layers.at(-1)![0]!]! > 0) {
    const next: number[] = [];
    for (const current of layers.at(-1)!) {
      for (
        let edge = graph.edgeStarts[current]!;
        edge < graph.edgeStarts[current + 1]!;
        edge += 1
      ) {
        const neighbor = graph.edges[edge]!;
        if (
          optimal[neighbor] === optimal[current]! - 1 &&
          !seen.has(neighbor)
        ) {
          seen.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    layers.push(next);
  }
  return layers;
}

/**
 * 今の問題集の全問を、駒の組ごとに全局面から分析し直して確かめる。
 * - 問題の数が目安と下限のあいだにあり、最短手数・準備の長さ・遠回り・最短の解の準備・レベルが分析し直した値と同じ。
 * - 準備の長さと遠回りが、同じ盤面を2度通らず娘の手を続けない解で出る。
 * - 近い問題が無い。生成の印とは別に、各問とその左右反転から4手以内の盤面と最短解の上の盤面をたどり、同じレベルのほかの問題
 *   （の盤面かその反転）に当たる組と、違うレベルの問題に当たる組を数える。同じレベルの2問の最短解が合流する（後半が同じになる）
 *   長さを、短い方の最短手数に対する割合で数え、`HAKOIRI_MUSUME_MERGE_SHARE` 以上の組も近い問題に数える。
 * - 同じ最終局面（娘が出口の前に着く1手前の盤面。反転は同じ）を最短解に持つ問題の数が、レベルの上限以下。
 */
function verify() {
  const pool = JSON.parse(
    readFileSync(outputPath, "utf8"),
  ) as HakoiriMusumeProblemPool;
  const failures: string[] = [];
  const entriesBySet = new Map<
    string,
    {
      difficulty: HakoiriMusumeDifficulty;
      entry: HakoiriMusumeProblemPoolEntry;
    }[]
  >();
  for (const { id: difficulty } of difficultyLevels) {
    const entries = pool.levels[difficulty];
    const { target, minimum } = problemCountByDifficulty[difficulty];
    if (entries.length < minimum || entries.length > target) {
      failures.push(`level ${difficulty}: ${entries.length} problems`);
    }
    for (const entry of entries) {
      const key = formatHakoiriMusumePieceSet(
        countHakoiriMusumePieceSet(entry[0]),
      );
      entriesBySet.set(key, [
        ...(entriesBySet.get(key) ?? []),
        { difficulty, entry },
      ]);
    }
  }
  const seenBoards = new Set<string>();
  const mergeRatios = createLevelRecord<number[]>(() => []);
  let nearPairs = 0;
  let crossLevelPairs = 0;
  let finalPositionExcess = 0;
  for (const [key, entries] of entriesBySet) {
    const space = analyzeHakoiriMusumePieceSet(
      countHakoiriMusumePieceSet(entries[0]!.entry[0]),
    );
    const { graph, measures, emptyCellCount } = space;
    type Problem = { difficulty: HakoiriMusumeDifficulty; index: number };
    const problems: Problem[] = [];
    for (const { difficulty, entry } of entries) {
      const [
        board,
        optimalMoveCount,
        preparationLength,
        daughterDetourCount,
        shortestPreparationLength,
      ] = entry;
      const index = graph.indexByBoard.get(board);
      if (index === undefined) {
        failures.push(`${board}: not a board of ${key}`);
        continue;
      }
      const canonical = [board, mirrorHakoiriMusumeBoard(board)].sort()[0]!;
      if (seenBoards.has(canonical)) {
        failures.push(`${board}: duplicated`);
      }
      seenBoards.add(canonical);
      const assessment = classifyHakoiriMusumeFeatures({
        optimalMoveCount: measures.optimal[index]!,
        preparationLength: measures.preparation[index]!,
        shortestPreparationLength: measures.shortestPreparation[index]!,
        daughterDetourCount: measures.detour[index]!,
        emptyCellCount,
      });
      const expected = [
        ["optimal", measures.optimal[index], optimalMoveCount],
        ["preparation", measures.preparation[index], preparationLength],
        ["detour", measures.detour[index], daughterDetourCount],
        [
          "shortest preparation",
          measures.shortestPreparation[index],
          shortestPreparationLength,
        ],
      ] as const;
      for (const [name, measured, pooled] of expected) {
        if (measured !== pooled) {
          failures.push(`${board}: ${name} ${measured} != ${pooled}`);
        }
      }
      if (
        assessment.status !== "classified" ||
        assessment.difficulty !== difficulty
      ) {
        failures.push(
          `${board}: ${JSON.stringify(assessment)} != level ${difficulty}`,
        );
      }
      // 準備の長さと遠回りが、同じ盤面を2度通らず娘の手を続けない解で出ることを、解の道の上だけで数え直して確かめる。
      // その解に、ほかの駒の手と入れ替えて1手にまとめられる2つの娘の手が無いことも確かめる。
      const witness = findHakoiriMusumeSimplePreparationPath(
        graph,
        measures,
        index,
        measures.preparation[index]!,
        measures.detour[index]!,
      );
      const recounted =
        witness &&
        measureHakoiriMusumePathPreparation(
          witness.map((board) => graph.boards[board]!),
        );
      const detourLimit = measures.detour[index]!;
      if (
        !recounted?.simple ||
        !recounted.separateDaughterMoves ||
        (witness !== null &&
          !keepsHakoiriMusumePreparationWhenMerged(
            witness.map((board) => graph.boards[board]!),
          )) ||
        recounted.preparation !== measures.preparation[index] ||
        (detourLimit <= HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT
          ? recounted.detour > detourLimit
          : recounted.detour <= HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT)
      )
        failures.push(
          `${board}: no simple solution with preparation ${measures.preparation[index]} (${JSON.stringify(recounted)})`,
        );
      problems.push({ difficulty, index });
    }
    const mirrorOf = (index: number) =>
      graph.indexByBoard.get(mirrorHakoiriMusumeBoard(graph.boards[index]!))!;
    // 盤面ごとの、その盤面（か反転）を始めに持つ問題の番号
    const ownerByBoard = new Map<number, number>();
    problems.forEach(({ index }, order) => {
      ownerByBoard.set(index, order);
      ownerByBoard.set(mirrorOf(index), order);
    });
    /** 問題 `order` から問題 `other` の始めに当たった。同じレベルなら近い問題、違うレベルならレベルをまたぐ近い問題。 */
    const reportHit = (order: number, other: number, how: string) => {
      const from = problems[order]!;
      const hit = problems[other]!;
      const fromBoard = graph.boards[from.index];
      const hitBoard = graph.boards[hit.index];
      if (from.difficulty === hit.difficulty) {
        nearPairs += 1;
        failures.push(`${hitBoard}: ${how} ${fromBoard}`);
      } else {
        crossLevelPairs += 1;
        failures.push(
          `${hitBoard} (level ${hit.difficulty}): ${how} ${fromBoard} (level ${from.difficulty})`,
        );
      }
    };
    const ownersByBoardByLevel = createLevelRecord<Map<number, number[]>>(
      () => new Map(),
    );
    const finalPositionCounts = createLevelRecord<Map<number, number>>(
      () => new Map(),
    );
    problems.forEach(({ difficulty, index }, order) => {
      const { finalPositionLimit } = hakoiriMusumeLevelSelections[difficulty];
      const ownersByBoard = ownersByBoardByLevel[difficulty];
      const merged = new Set<number>();
      const finals = new Set<number>();
      for (const start of new Set([index, mirrorOf(index)])) {
        for (const reached of listBoardsWithinMoves(
          graph,
          start,
          HAKOIRI_MUSUME_NEAR_MOVE_COUNT,
        )) {
          const other = ownerByBoard.get(reached);
          if (other !== undefined && other !== order) {
            reportHit(
              order,
              other,
              `within ${HAKOIRI_MUSUME_NEAR_MOVE_COUNT} moves of`,
            );
          }
        }
        const layers = listShortestDescendantLayers(
          graph,
          measures.optimal,
          start,
        );
        for (const board of layers.at(-2) ?? []) {
          finals.add(Math.min(board, mirrorOf(board)));
        }
        for (const layer of layers) {
          for (const board of layer) {
            const other = ownerByBoard.get(board);
            if (other !== undefined && other !== order) {
              reportHit(order, other, "on a shortest solution of");
            }
            for (const sharer of ownersByBoard.get(board) ?? []) {
              if (sharer === order || merged.has(sharer)) {
                continue;
              }
              merged.add(sharer);
              const ratio =
                measures.optimal[board]! /
                Math.min(
                  measures.optimal[index]!,
                  measures.optimal[problems[sharer]!.index]!,
                );
              mergeRatios[difficulty].push(ratio);
              if (ratio >= HAKOIRI_MUSUME_MERGE_SHARE) {
                nearPairs += 1;
                failures.push(
                  `${graph.boards[index]}: shares ${measures.optimal[board]} moves with ${graph.boards[problems[sharer]!.index]}`,
                );
              }
            }
          }
        }
        for (const layer of layers) {
          for (const board of layer) {
            const owners = ownersByBoard.get(board) ?? [];
            if (!owners.includes(order)) {
              ownersByBoard.set(board, [...owners, order]);
            }
          }
        }
      }
      for (const position of finals) {
        const count = (finalPositionCounts[difficulty].get(position) ?? 0) + 1;
        finalPositionCounts[difficulty].set(position, count);
        if (count > finalPositionLimit) {
          finalPositionExcess += 1;
          failures.push(
            `${graph.boards[index]}: final position ${graph.boards[position]} shared by ${count} problems`,
          );
        }
      }
    });
    console.error(`${key}: ${entries.length} problems verified`);
  }
  const mergeSummary = Object.fromEntries(
    difficultyLevels.map(({ id: difficulty }) => {
      const ratios = mergeRatios[difficulty].sort(
        (left, right) => left - right,
      );
      const share = (minimum: number) =>
        Math.round(
          (ratios.filter((ratio) => ratio >= minimum).length /
            Math.max(1, ratios.length)) *
            1000,
        ) / 1000;
      return [
        difficulty,
        {
          pairs: ratios.length,
          percentiles: [0, 10, 50, 90, 100].map(
            (percent) =>
              Math.round(
                (ratios[
                  Math.min(
                    ratios.length - 1,
                    Math.floor((ratios.length * percent) / 100),
                  )
                ] ?? 0) * 100,
              ) / 100,
          ),
          atLeastQuarter: share(0.25),
          atLeastMergeShare: share(HAKOIRI_MUSUME_MERGE_SHARE),
        },
      ];
    }),
  );
  console.log(
    JSON.stringify(
      { nearPairs, crossLevelPairs, finalPositionExcess, merge: mergeSummary },
      null,
      1,
    ),
  );
  if (failures.length > 0) {
    console.error(failures.slice(0, 20).join("\n"));
    throw new Error(`${failures.length} problems failed verification`);
  }
  console.log(
    `verified ${[...entriesBySet.values()].reduce((sum, entries) => sum + entries.length, 0)} problems`,
  );
}

const { values } = parseArgs({
  options: {
    seed: { type: "string", default: defaultSeed },
    cache: { type: "string", default: defaultCacheDirectory },
    verify: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(formatUsage());
} else if (values.verify) {
  verify();
} else {
  generate(values.seed, values.cache);
}
