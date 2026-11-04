import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";

import { difficultyLevels } from "@/games/difficulty";
import {
  classifyHakoiriMusumeFeatures,
  type HakoiriMusumeDifficulty,
} from "@/games/hakoiri-musume/difficulty";
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
  hakoiriMusumePieceSets,
  interleaveHakoiriMusumeProblems,
  listHakoiriMusumeCandidates,
  pickHakoiriMusumePieceSetProblems,
} from "@/games/hakoiri-musume/problem/generation/pool-selection";
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

/** レベルごとの問題数。レベル5 は近い問題と合流する問題を除くと約 460 問しか採れないので絞る。 */
const problemCountByDifficulty = {
  "1": 500,
  "2": 500,
  "3": 500,
  "4": 500,
  "5": 300,
} as const satisfies Record<HakoiriMusumeDifficulty, number>;

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
type PieceSetResult = {
  pieceSet: HakoiriMusumePieceSet;
  stateCount: number;
  candidateCount: number;
  statusCounts: Histogram;
  classifiedFeatureHistograms: Record<
    HakoiriMusumeDifficulty,
    Record<keyof HakoiriMusumeDifficultyFeatures, Histogram>
  >;
  picked: Record<HakoiriMusumeDifficulty, HakoiriMusumeCandidate[]>;
  naivePlays: Record<HakoiriMusumeDifficulty, NaivePlayRecord[]>;
  elapsedMs: number;
};

const featureKeys = [
  "optimalMoveCount",
  "preparationLength",
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
  for (const { assessment, features } of candidates) {
    if (assessment.status === "classified") {
      addTo(statusCounts, assessment.difficulty);
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
  const picked = pickHakoiriMusumePieceSetProblems(
    space,
    candidates,
    seed,
    Math.max(...Object.values(problemCountByDifficulty)),
  );
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
    picked,
    naivePlays,
    elapsedMs: Math.round(performance.now() - startedAt),
  };
}

function readOrProcess(
  pieceSet: HakoiriMusumePieceSet,
  seed: string,
  cacheDirectory: string,
): PieceSetResult {
  const cachePath = path.join(
    cacheDirectory,
    `${HAKOIRI_MUSUME_GENERATOR_VERSION}-${seed}-${formatHakoiriMusumePieceSet(pieceSet)}.json`,
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

function generate(seed: string, cacheDirectory: string) {
  mkdirSync(cacheDirectory, { recursive: true });
  const results = orderPieceSets(seed).map((pieceSet) =>
    readOrProcess(pieceSet, seed, cacheDirectory),
  );
  const levels = createLevelRecord<HakoiriMusumeProblemPoolEntry[]>(() => []);
  const statistics: Record<string, unknown> = {};
  for (const { id: difficulty } of difficultyLevels) {
    const count = problemCountByDifficulty[difficulty];
    const problems = interleaveHakoiriMusumeProblems(
      results.map(({ picked }) => picked[difficulty]),
      count,
    );
    if (problems.length < count) {
      throw new Error(
        `Level ${difficulty} has only ${problems.length} of ${count} problems`,
      );
    }
    levels[difficulty] = problems.map(({ board, features }) => [
      board,
      features.optimalMoveCount,
      features.preparationLength,
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
    statistics[difficulty] = {
      naivePlay: { problems: naivePlays.length, ...naiveSummary },
      pooled: problems.length,
      classifiedCandidates: Object.values(allClassified).reduce(
        (sum, value) => sum + value,
        0,
      ),
      availableAfterNearFilter: results.reduce(
        (sum, { picked }) => sum + picked[difficulty].length,
        0,
      ),
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
 * 今の問題集の全問を、駒の組ごとに全局面から分析し直して確かめる。近い問題は、生成の印とは別に、各問から4手以内の盤面と
 * 最短解の上の盤面をたどって、同じレベルのほかの問題に当たる組を数える。あわせて、同じレベルの2問の最短解が合流する
 * （後半が同じになる）長さを、短い方の最短手数に対する割合で数え、`HAKOIRI_MUSUME_MERGE_SHARE` 以上の組も近い問題に数える。
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
    if (entries.length !== problemCountByDifficulty[difficulty]) {
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
  for (const [key, entries] of entriesBySet) {
    const space = analyzeHakoiriMusumePieceSet(
      countHakoiriMusumePieceSet(entries[0]!.entry[0]),
    );
    const { graph, measures, emptyCellCount } = space;
    const indicesByLevel = createLevelRecord<number[]>(() => []);
    for (const { difficulty, entry } of entries) {
      const [board, optimalMoveCount, preparationLength] = entry;
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
        daughterDetourCount: measures.detour[index]!,
        emptyCellCount,
      });
      if (measures.optimal[index] !== optimalMoveCount) {
        failures.push(
          `${board}: optimal ${measures.optimal[index]} != ${optimalMoveCount}`,
        );
      }
      if (measures.preparation[index] !== preparationLength) {
        failures.push(
          `${board}: preparation ${measures.preparation[index]} != ${preparationLength}`,
        );
      }
      if (
        assessment.status !== "classified" ||
        assessment.difficulty !== difficulty
      ) {
        failures.push(
          `${board}: ${JSON.stringify(assessment)} != level ${difficulty}`,
        );
      }
      indicesByLevel[difficulty].push(index);
    }
    for (const { id: difficulty } of difficultyLevels) {
      const indices = indicesByLevel[difficulty];
      const pooled = new Set(indices);
      // 盤面ごとに、最短解の上にその盤面を持つ問題（の並びの番号）
      const ownersByBoard = new Map<number, number[]>();
      indices.forEach((start, order) => {
        for (const reached of listBoardsWithinMoves(
          graph,
          start,
          HAKOIRI_MUSUME_NEAR_MOVE_COUNT,
        )) {
          if (reached !== start && pooled.has(reached)) {
            nearPairs += 1;
            failures.push(
              `${graph.boards[start]}: within ${HAKOIRI_MUSUME_NEAR_MOVE_COUNT} moves of ${graph.boards[reached]}`,
            );
          }
        }
        const merged = new Set<number>();
        for (const layer of listShortestDescendantLayers(
          graph,
          measures.optimal,
          start,
        )) {
          for (const board of layer) {
            if (board !== start && pooled.has(board)) {
              nearPairs += 1;
              failures.push(
                `${graph.boards[board]}: on a shortest solution of ${graph.boards[start]}`,
              );
            }
            for (const other of ownersByBoard.get(board) ?? []) {
              if (!merged.has(other)) {
                merged.add(other);
                const ratio =
                  measures.optimal[board]! /
                  Math.min(
                    measures.optimal[start]!,
                    measures.optimal[indices[other]!]!,
                  );
                mergeRatios[difficulty].push(ratio);
                if (ratio >= HAKOIRI_MUSUME_MERGE_SHARE) {
                  nearPairs += 1;
                  failures.push(
                    `${graph.boards[start]}: shares ${measures.optimal[board]} moves with ${graph.boards[indices[other]!]}`,
                  );
                }
              }
            }
            ownersByBoard.set(board, [
              ...(ownersByBoard.get(board) ?? []),
              order,
            ]);
          }
        }
      });
    }
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
  console.log(JSON.stringify({ nearPairs, merge: mergeSummary }, null, 1));
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
