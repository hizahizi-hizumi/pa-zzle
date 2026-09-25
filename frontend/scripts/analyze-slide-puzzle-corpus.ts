import { createProblemSeededRandom } from "@/games/problem-seed";
import {
  assessSlidePuzzleDifficulty,
  SLIDE_PUZZLE_MINIMUM_OPTIMAL_MOVE_COUNT,
  slidePuzzleDifficulties,
} from "@/games/slide-puzzle/difficulty";
import {
  analyzeSlidePuzzleDifficulty,
  type SlidePuzzleDifficultyFeatures,
} from "@/games/slide-puzzle/problem/difficulty-analysis";
import {
  buildSlidePuzzlePatternDatabase,
  createSlidePuzzlePatternDatabaseHeuristic,
} from "@/games/slide-puzzle/problem/generation/pattern-database";
import {
  type SlidePuzzleHeuristic,
  solveSlidePuzzleOptimally,
} from "@/games/slide-puzzle/problem/generation/solver";
import { generateSlidePuzzleBoard } from "@/games/slide-puzzle/problem/generator";
import {
  listSlidePuzzlePoolEntries,
  toSlidePuzzlePooledProblem,
} from "@/games/slide-puzzle/problem/problem-pool";
import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
  listSlidePuzzleSingleMoves,
} from "@/games/slide-puzzle/puzzle/rules";
import {
  calculateSlidePuzzleManhattanDistance,
  getSlidePuzzleBoardSize,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";

// 問題集の候補と同じ seed（fp<撹拌手数>-<連番>）で、撹拌手数ごとに先頭から分析する。
const corpusScrambleLengths = [
  10, 15, 20, 25, 30, 35, 40, 50, 60, 80, 100, 120, 160, 200, 300,
];
const corpusBoardSize: SlidePuzzleBoardSize = 4;
const greedyTrialCount = 50;

type Sample = SlidePuzzleDifficultyFeatures & {
  seed: string;
  scrambleLength: number;
  board: SlidePuzzleBoard;
  solveMs: number;
};

function readOption(name: string, fallback: number): number {
  const index = Bun.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(Bun.argv[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`--${name} must be a positive integer`);
  }
  return value;
}

function quantile(values: readonly number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.round(ratio * (sorted.length - 1))] ?? Number.NaN;
}

function summarize(values: readonly number[]): string {
  return [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => quantile(values, ratio))
    .join(" / ");
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function ranks(values: readonly number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const result = new Array<number>(values.length).fill(0);
  for (let start = 0; start < order.length; ) {
    let end = start;
    while (order[end + 1]?.value === order[start]?.value) {
      end += 1;
    }
    for (let position = start; position <= end; position += 1) {
      result[order[position]?.index ?? 0] = (start + end) / 2;
    }
    start = end + 1;
  }
  return result;
}

function spearman(left: readonly number[], right: readonly number[]): string {
  const leftRanks = ranks(left);
  const rightRanks = ranks(right);
  const leftMean = mean(leftRanks);
  const rightMean = mean(rightRanks);
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (const [index, leftRank] of leftRanks.entries()) {
    const rightRank = rightRanks[index] ?? 0;
    covariance += (leftRank - leftMean) * (rightRank - rightMean);
    leftVariance += (leftRank - leftMean) ** 2;
    rightVariance += (rightRank - rightMean) ** 2;
  }
  return (covariance / Math.sqrt(leftVariance * rightVariance)).toFixed(2);
}

/**
 * マンハッタン距離を必ず減らす手だけを無作為に選び続ける素朴なプレイ。
 * 遠回り手数 0 の問題でも、減らす手の順番を誤ると行き詰まる。
 */
function isGreedyPlayCompleted(
  initialBoard: SlidePuzzleBoard,
  random: () => number,
): boolean {
  let board = initialBoard;
  let distance = calculateSlidePuzzleManhattanDistance(board);
  while (distance > 0) {
    const nextBoards = listSlidePuzzleSingleMoves(board).flatMap(
      (tileIndex) => {
        const slide = getSlidePuzzleSlide(board, tileIndex);
        const nextBoard = slide ? applySlidePuzzleSlide(board, slide) : null;
        return nextBoard &&
          calculateSlidePuzzleManhattanDistance(nextBoard) < distance
          ? [nextBoard]
          : [];
      },
    );
    const nextBoard = nextBoards[Math.floor(random() * nextBoards.length)];
    if (!nextBoard) {
      return false;
    }
    board = nextBoard;
    distance -= 1;
  }
  return true;
}

function levelOf(sample: SlidePuzzleDifficultyFeatures) {
  return assessSlidePuzzleDifficulty({
    status: "analyzed",
    features: sample,
  });
}

function formatBoard(board: SlidePuzzleBoard): string {
  const boardSize = getSlidePuzzleBoardSize(board);
  return Array.from({ length: boardSize }, (_, row) =>
    board
      .slice(row * boardSize, (row + 1) * boardSize)
      .map((tile) => (tile === 0 ? " ." : String(tile).padStart(2)))
      .join(" "),
  ).join("\n");
}

function printTable(headers: readonly string[], rows: readonly string[][]) {
  console.log(`| ${headers.join(" | ")} |`);
  console.log(`| ${headers.map(() => "---:").join(" | ")} |`);
  for (const row of rows) {
    console.log(`| ${row.join(" | ")} |`);
  }
  console.log("");
}

function analyzeCorpus(
  perScramble: number,
  heuristic: SlidePuzzleHeuristic,
): Sample[] {
  const samples: Sample[] = [];
  let unsupportedCount = 0;
  for (const scrambleLength of corpusScrambleLengths) {
    for (let index = 0; index < perScramble; index += 1) {
      const seed = `fp${scrambleLength}-${index}`;
      const board = generateSlidePuzzleBoard(seed, {
        size: corpusBoardSize,
        scrambleLength,
      });
      const startedAt = performance.now();
      const solved = solveSlidePuzzleOptimally(board, { heuristic });
      const solveMs = performance.now() - startedAt;
      const analysis = analyzeSlidePuzzleDifficulty(
        board,
        solved.status === "solved" ? solved.optimalMoveCount : null,
      );
      if (analysis.status === "analyzed") {
        samples.push({
          ...analysis.features,
          seed,
          scrambleLength,
          board,
          solveMs,
        });
      } else {
        unsupportedCount += 1;
      }
    }
    console.error(`scramble ${scrambleLength}: done`);
  }
  console.log(`評価不能: ${unsupportedCount} 問\n`);
  return samples;
}

function printCorpusReport(samples: readonly Sample[]) {
  console.log("## 撹拌手数ごと\n");
  printTable(
    [
      "撹拌手数",
      "問題数",
      "最短 平均",
      "マンハッタン 平均",
      "遠回り （最小 / 25% / 中央 / 75% / 最大）",
      "最短 8 手未満",
      "計算 平均 ms",
      "計算 最大 ms",
    ],
    corpusScrambleLengths.map((scrambleLength) => {
      const group = samples.filter(
        (sample) => sample.scrambleLength === scrambleLength,
      );
      return [
        String(scrambleLength),
        String(group.length),
        mean(group.map((sample) => sample.optimalMoveCount)).toFixed(1),
        mean(group.map((sample) => sample.manhattanDistance)).toFixed(1),
        summarize(group.map((sample) => sample.detourMoveCount)),
        String(
          group.filter(
            (sample) =>
              sample.optimalMoveCount < SLIDE_PUZZLE_MINIMUM_OPTIMAL_MOVE_COUNT,
          ).length,
        ),
        mean(group.map((sample) => sample.solveMs)).toFixed(0),
        Math.max(...group.map((sample) => sample.solveMs)).toFixed(0),
      ];
    }),
  );

  const provided = samples.filter(
    (sample) =>
      sample.optimalMoveCount >= SLIDE_PUZZLE_MINIMUM_OPTIMAL_MOVE_COUNT,
  );
  console.log(
    `## 最短手数の層ごとの遠回り手数（最短 8 手以上 ${provided.length} 問）\n`,
  );
  const bands = [
    ...new Set(
      provided.map((sample) => Math.floor(sample.optimalMoveCount / 5) * 5),
    ),
  ].sort((left, right) => left - right);
  printTable(
    [
      "最短手数",
      "問題数",
      "遠回り （最小 / 25% / 中央 / 75% / 最大）",
      ...slidePuzzleDifficulties.map(({ label }) => label),
    ],
    bands.map((band) => {
      const group = provided.filter(
        (sample) => Math.floor(sample.optimalMoveCount / 5) * 5 === band,
      );
      return [
        `${Math.max(band, SLIDE_PUZZLE_MINIMUM_OPTIMAL_MOVE_COUNT)}〜${band + 4}`,
        String(group.length),
        summarize(group.map((sample) => sample.detourMoveCount)),
        ...slidePuzzleDifficulties.map(({ id }) =>
          String(group.filter((sample) => levelOf(sample) === id).length),
        ),
      ];
    }),
  );

  console.log("## レベルごとの最短手数・マンハッタン距離（候補全体）\n");
  printTable(
    [
      "レベル",
      "問題数",
      "最短 （最小 / 25% / 中央 / 75% / 最大）",
      "マンハッタン （最小 / 25% / 中央 / 75% / 最大）",
    ],
    slidePuzzleDifficulties.map(({ id }) => {
      const group = provided.filter((sample) => levelOf(sample) === id);
      return [
        id,
        String(group.length),
        summarize(group.map((sample) => sample.optimalMoveCount)),
        summarize(group.map((sample) => sample.manhattanDistance)),
      ];
    }),
  );

  console.log("## 撹拌手数ごとのレベル 5 の最短手数（候補全体）\n");
  printTable(
    ["撹拌手数", "問題数", "最短 （最小 / 25% / 中央 / 75% / 最大）"],
    corpusScrambleLengths.flatMap((scrambleLength) => {
      const optimalMoveCounts = provided
        .filter(
          (sample) =>
            sample.scrambleLength === scrambleLength && levelOf(sample) === "5",
        )
        .map((sample) => sample.optimalMoveCount);
      return optimalMoveCounts.length === 0
        ? []
        : [
            [
              String(scrambleLength),
              String(optimalMoveCounts.length),
              summarize(optimalMoveCounts),
            ],
          ];
    }),
  );

  console.log("## 順位相関（Spearman）\n");
  function pick(
    key: keyof SlidePuzzleDifficultyFeatures,
    group: readonly Sample[] = provided,
  ) {
    return group.map((sample) => sample[key]);
  }
  printTable(
    [
      "対象",
      "遠回り×最短",
      "マンハッタン×最短",
      "遠回り×マンハッタン",
      "遠回り×線形衝突対",
      "遠回り×正位置外",
    ],
    [
      ["全体", provided] as const,
      ...[20, 30, 40, 50].map(
        (low) =>
          [
            `最短 ${low}〜${low + 9}`,
            provided.filter(
              (sample) =>
                sample.optimalMoveCount >= low &&
                sample.optimalMoveCount <= low + 9,
            ),
          ] as const,
      ),
    ].map(([label, group]) => [
      `${label}（${group.length}）`,
      spearman(pick("detourMoveCount", group), pick("optimalMoveCount", group)),
      spearman(
        pick("manhattanDistance", group),
        pick("optimalMoveCount", group),
      ),
      spearman(
        pick("detourMoveCount", group),
        pick("manhattanDistance", group),
      ),
      spearman(
        pick("detourMoveCount", group),
        pick("linearConflictPairCount", group),
      ),
      spearman(
        pick("detourMoveCount", group),
        pick("misplacedTileCount", group),
      ),
    ]),
  );

  const levelCounts = slidePuzzleDifficulties.map(
    ({ id }) => provided.filter((sample) => levelOf(sample) === id).length,
  );
  const byLength = [...provided].sort(
    (left, right) => left.optimalMoveCount - right.optimalMoveCount,
  );
  const lengthLevel = new Map<Sample, number>();
  let offset = 0;
  for (const [levelIndex, count] of levelCounts.entries()) {
    for (const sample of byLength.slice(offset, offset + count)) {
      lengthLevel.set(sample, levelIndex + 1);
    }
    offset += count;
  }
  const differences = provided.map((sample) =>
    Math.abs((lengthLevel.get(sample) ?? 0) - Number(levelOf(sample))),
  );
  console.log("## 最短手数だけで同じ問題数に分けた場合との比較\n");
  printTable(
    ["レベル差 0", "差 1", "差 2 以上"],
    [
      [
        String(differences.filter((difference) => difference === 0).length),
        String(differences.filter((difference) => difference === 1).length),
        String(differences.filter((difference) => difference >= 2).length),
      ],
    ],
  );

  console.log(
    `## 遠回り手数 0 の問題で、マンハッタン距離を減らす手だけを無作為に選ぶプレイ（各 ${greedyTrialCount} 回）の完成率\n`,
  );
  const straightSamples = provided.filter(
    (sample) => sample.detourMoveCount === 0,
  );
  const straightBands = [
    ...new Set(
      straightSamples.map(
        (sample) => Math.floor(sample.optimalMoveCount / 4) * 4,
      ),
    ),
  ].sort((left, right) => left - right);
  printTable(
    ["最短手数", "問題数", "完成率 （最小 / 25% / 中央 / 75% / 最大）", "平均"],
    straightBands.map((band) => {
      const rates = straightSamples
        .filter(
          (sample) => Math.floor(sample.optimalMoveCount / 4) * 4 === band,
        )
        .map((sample) => {
          const random = createProblemSeededRandom(`greedy:${sample.seed}`);
          let completedCount = 0;
          for (let trial = 0; trial < greedyTrialCount; trial += 1) {
            if (isGreedyPlayCompleted(sample.board, random)) {
              completedCount += 1;
            }
          }
          return completedCount / greedyTrialCount;
        });
      return [
        `${band}〜${band + 3}`,
        String(rates.length),
        summarize(rates.map((rate) => Number(rate.toFixed(2)))),
        mean(rates).toFixed(2),
      ];
    }),
  );
}

function printPoolReport() {
  const levels = slidePuzzleDifficulties.map(({ id }) => ({
    id,
    samples: listSlidePuzzlePoolEntries(id).map((entry) => {
      const { identity, optimalMoveCount } = toSlidePuzzlePooledProblem(entry);
      const board = generateSlidePuzzleBoard(
        identity.seed,
        identity.conditions,
      );
      const analysis = analyzeSlidePuzzleDifficulty(board, optimalMoveCount);
      if (analysis.status !== "analyzed") {
        throw new Error(`Pool entry ${identity.seed} is not analyzable`);
      }
      return { ...analysis.features, seed: identity.seed, board };
    }),
  }));

  console.log("## 問題集\n");
  printTable(
    [
      "レベル",
      "問題数",
      "遠回り （最小 / 25% / 中央 / 75% / 最大）",
      "最短 （最小 / 25% / 中央 / 75% / 最大）",
      "マンハッタン （最小 / 25% / 中央 / 75% / 最大）",
    ],
    levels.map(({ id, samples }) => [
      id,
      String(samples.length),
      summarize(samples.map((sample) => sample.detourMoveCount)),
      summarize(samples.map((sample) => sample.optimalMoveCount)),
      summarize(samples.map((sample) => sample.manhattanDistance)),
    ]),
  );

  console.log("## 問題集の代表・境界・異常な問題\n");
  const all = levels.flatMap(({ id, samples }) =>
    samples.map((sample) => ({ ...sample, level: id })),
  );
  function describe(title: string, sample: (typeof all)[number] | undefined) {
    if (!sample) {
      return;
    }
    console.log(
      `### ${title}: レベル ${sample.level} ${sample.seed}（最短 ${sample.optimalMoveCount} / マンハッタン ${sample.manhattanDistance} / 遠回り ${sample.detourMoveCount} / 正位置外 ${sample.misplacedTileCount} / 線形衝突対 ${sample.linearConflictPairCount}）\n`,
    );
    console.log(`\`\`\`text\n${formatBoard(sample.board)}\n\`\`\`\n`);
  }
  for (const { id, samples } of levels) {
    const detour = quantile(
      samples.map((sample) => sample.detourMoveCount),
      0.5,
    );
    const optimal = quantile(
      samples.map((sample) => sample.optimalMoveCount),
      0.5,
    );
    describe(
      "代表",
      [...samples]
        .filter((sample) => sample.detourMoveCount === detour)
        .sort(
          (left, right) =>
            Math.abs(left.optimalMoveCount - optimal) -
            Math.abs(right.optimalMoveCount - optimal),
        )
        .map((sample) => ({ ...sample, level: id }))[0],
    );
  }
  for (const lowerDetour of [1, 3, 5, 7]) {
    const lowerSide = all.filter(
      (sample) => sample.detourMoveCount === lowerDetour,
    );
    const upperSide = all.filter(
      (sample) => sample.detourMoveCount === lowerDetour + 1,
    );
    const sharedOptimal = quantile(
      lowerSide
        .map((sample) => sample.optimalMoveCount)
        .filter((optimal) =>
          upperSide.some((sample) => sample.optimalMoveCount === optimal),
        ),
      0.5,
    );
    const title = `境界 遠回り ${lowerDetour}|${lowerDetour + 1}（最短 ${sharedOptimal} 手）`;
    describe(
      title,
      lowerSide.find((sample) => sample.optimalMoveCount === sharedOptimal),
    );
    describe(
      title,
      upperSide.find((sample) => sample.optimalMoveCount === sharedOptimal),
    );
  }
  for (const optimal of [26, 34, 42]) {
    const sameLength = all
      .filter((sample) => sample.optimalMoveCount === optimal)
      .sort((left, right) => left.detourMoveCount - right.detourMoveCount);
    describe(`最短 ${optimal} 手で遠回りが最小`, sameLength[0]);
    describe(`最短 ${optimal} 手で遠回りが最大`, sameLength.at(-1));
  }
  const byDetourThenLength = [...all].sort(
    (left, right) =>
      left.optimalMoveCount - right.optimalMoveCount ||
      left.detourMoveCount - right.detourMoveCount,
  );
  for (const { id } of slidePuzzleDifficulties) {
    const levelSamples = byDetourThenLength.filter(
      (sample) => sample.level === id,
    );
    describe(`レベル ${id} で最短手数が最小`, levelSamples[0]);
    describe(`レベル ${id} で最短手数が最大`, levelSamples.at(-1));
  }
}

// 1 行目の 2 組を入れ替えただけの盤面。ランダムウォークの候補には現れにくい、見た目の散らかりと遠回り手数が離れた例として出す。
const swappedFirstRowBoard: SlidePuzzleBoard = [
  2, 1, 4, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0,
];

function printHandmadeBoardReport(heuristic: SlidePuzzleHeuristic) {
  const solved = solveSlidePuzzleOptimally(swappedFirstRowBoard, {
    heuristic,
  });
  const analysis = analyzeSlidePuzzleDifficulty(
    swappedFirstRowBoard,
    solved.status === "solved" ? solved.optimalMoveCount : null,
  );
  if (analysis.status !== "analyzed") {
    throw new Error("Handmade board is not analyzable");
  }

  const features = analysis.features;
  console.log(
    `## 問題集の外（参考）: 1 行目の 2 組を入れ替えた盤面（最短 ${features.optimalMoveCount} / マンハッタン ${features.manhattanDistance} / 遠回り ${features.detourMoveCount} / 正位置外 ${features.misplacedTileCount} / 線形衝突対 ${features.linearConflictPairCount}）\n`,
  );
  console.log(`\`\`\`text\n${formatBoard(swappedFirstRowBoard)}\n\`\`\`\n`);
}

if (!Bun.argv.includes("--pool-only")) {
  const heuristic = createSlidePuzzlePatternDatabaseHeuristic(
    buildSlidePuzzlePatternDatabase(),
  );
  printCorpusReport(analyzeCorpus(readOption("per-scramble", 300), heuristic));
  printHandmadeBoardReport(heuristic);
}
printPoolReport();
