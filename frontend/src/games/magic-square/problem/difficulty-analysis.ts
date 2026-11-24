import {
  type MagicSquareReadOptions,
  type MagicSquareReadResult,
  readMagicSquare,
} from "@/games/magic-square/problem/generation/read-model";
import {
  listMagicSquareAlternativeReadings,
  magicSquareVirtualLines4,
} from "@/games/magic-square/problem/generation/reading-parts";
import {
  countMagicSquareSolutions,
  type MagicSquareGrid,
} from "@/games/magic-square/problem/generation/solver";

/** 答えを数える完全な解法器の節点の上限。計算を止めるためのもので、届いた問題は成立しないとみなす。 */
export const MAGIC_SQUARE_SOLUTION_SEARCH_NODE_CAP = 2_000_000;

/**
 * 1つの読み方で読み切った記録から取る特徴。「所」は、置けるマスが出るまでの1か所（段1で置ける所も1か所）。
 * 段2以上の所を「行き詰まった所」と呼ぶ。
 */
export type MagicSquareReadingFeatures = {
  status: MagicSquareReadResult["status"];
  /** 最初の盤面で、段1の1巡で決まるマスの数（入口）。最初の所が段2以上なら 0。 */
  entryCellCount: number;
  /** 最初の所の段と巡。所が無ければ 0。 */
  firstTier: number;
  firstSweeps: number;
  /** 所の段の最大。 */
  tierMax: number;
  /** 所の数。 */
  placeCount: number;
  /** 行き詰まった所の数（組の突き合わせの回数）。 */
  stuckPlaceCount: number;
  /** 段3以上の所の数。 */
  tier3PlaceCount: number;
  /** 段2の所の巡の最大。 */
  tier2SweepsMax: number;
  /** 段3以上の所の巡の最大。 */
  tier3SweepsMax: number;
  /** 行き詰まった所の巡の最大（1か所の読みの依存の長さ）。 */
  stuckSweepsMax: number;
  /** 行き詰まった所の巡の合計。 */
  stuckSweepTotal: number;
  /** 巡が2以上の所の数（絞り直しの回数）。 */
  reworkedPlaceCount: number;
  /** 巡が3以上の所の数。 */
  threeSweepPlaceCount: number;
  /** 「この数はここだけ」だけで決まった所の数。 */
  hiddenOnlyPlaceCount: number;
  /** 「組の数を他で使わない」で候補が消えた、行き詰まった所の数。 */
  lockPlaceCount: number;
  /** 行き詰まった所の1巡目に読んだ鎖の列の数の最大。 */
  chainLineCountMax: number;
  /** 行き詰まった所の1巡目に読んだ、空きが2マス以上の単位の入れ方の組の数の中央値と最大。 */
  combinationCountMedian: number;
  combinationCountMax: number;
};

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function maximum(values: readonly number[]): number {
  return values.reduce((largest, value) => Math.max(largest, value), 0);
}

export function summarizeMagicSquareReading(
  result: MagicSquareReadResult,
): MagicSquareReadingFeatures {
  const { steps } = result;
  const [first] = steps;
  const stuck = steps.filter(({ tier }) => tier >= 2);
  const combinationCounts = stuck.flatMap(({ combos }) => combos);
  return {
    status: result.status,
    entryCellCount: first && first.tier === 1 ? first.found : 0,
    firstTier: first?.tier ?? 0,
    firstSweeps: first?.sweeps ?? 0,
    tierMax: maximum(steps.map(({ tier }) => tier)),
    placeCount: steps.length,
    stuckPlaceCount: stuck.length,
    tier3PlaceCount: steps.filter(({ tier }) => tier >= 3).length,
    tier2SweepsMax: maximum(
      steps.filter(({ tier }) => tier === 2).map(({ sweeps }) => sweeps),
    ),
    tier3SweepsMax: maximum(
      steps.filter(({ tier }) => tier >= 3).map(({ sweeps }) => sweeps),
    ),
    stuckSweepsMax: maximum(stuck.map(({ sweeps }) => sweeps)),
    stuckSweepTotal: stuck.reduce((total, { sweeps }) => total + sweeps, 0),
    reworkedPlaceCount: stuck.filter(({ sweeps }) => sweeps >= 2).length,
    threeSweepPlaceCount: stuck.filter(({ sweeps }) => sweeps >= 3).length,
    hiddenOnlyPlaceCount: steps.filter(
      ({ kinds }) => kinds.length === 1 && kinds[0] === "hidden",
    ).length,
    lockPlaceCount: stuck.filter(({ lock }) => lock).length,
    chainLineCountMax: maximum(stuck.map(({ chain }) => chain)),
    combinationCountMedian: median(combinationCounts),
    combinationCountMax: maximum(combinationCounts),
  };
}

/** 読み方 `options` で読み切った特徴。 */
export function measureMagicSquareReading(
  size: number,
  givens: MagicSquareGrid,
  options: Partial<MagicSquareReadOptions> = {},
): MagicSquareReadingFeatures {
  return summarizeMagicSquareReading(readMagicSquare(size, givens, options));
}

/** 4×4 の仮想の列を足して、同じ読み方で読んだ特徴。4×4 のほかは仮想の列が無いので `null`。 */
export function measureMagicSquareVirtualReading(
  size: number,
  givens: MagicSquareGrid,
  options: Partial<MagicSquareReadOptions> = {},
): MagicSquareReadingFeatures | null {
  return size === 4
    ? measureMagicSquareReading(size, givens, {
        ...options,
        extraLines: magicSquareVirtualLines4,
      })
    : null;
}

/** 段1だけで解け、どの与える数を1つ外しても段1だけでは解けないか。 */
export function isMagicSquareTier1Minimal(
  size: number,
  givens: MagicSquareGrid,
): boolean {
  const solvesByTier1 = (grid: MagicSquareGrid) =>
    readMagicSquare(size, grid, { maxTier: 1 }).status === "solved";
  if (!solvesByTier1(givens)) {
    return false;
  }
  return givens.every(
    (value, cell) =>
      !value ||
      !solvesByTier1(
        givens.map((other, index) => (index === cell ? 0 : other)),
      ),
  );
}

/** 部品やその組み合わせで読んだ特徴。仮想の列を足した読みは、レベルを比べる時にだけ要るので、求められた時に読む。 */
export type MagicSquareAlternativeReading = {
  id: string;
  features: MagicSquareReadingFeatures;
  measureVirtual: () => MagicSquareReadingFeatures | null;
};

export type MagicSquareDifficultyFeatures = {
  boardSize: number;
  givenCount: number;
  emptyCellCount: number;
  /** 基準の読むモデルで読んだ特徴。 */
  reading: MagicSquareReadingFeatures;
  /** 4×4 の仮想の列を足して基準の読むモデルで読んだ特徴。 */
  virtualReading: MagicSquareReadingFeatures | null;
  /** 段1だけで解け、与える数が段1で極小か。段2以上が要る問題では偽。 */
  tier1Minimal: boolean;
  /** 答えを数えた完全な解法器の節点の数。 */
  solutionSearchNodeCount: number;
};

/**
 * - `analyzed`: 答えが1つ。
 * - `invalid`: 答えが無いか2つ以上、または完全な解法器の上限に届いた。
 * 部品の読みは数が多く重い（部品の1〜3つの組み合わせで 5,507 通り）ので、`listAlternativeReadings` は読むたびに1つずつ返す。
 */
export type MagicSquareDifficultyAnalysis =
  | {
      status: "analyzed";
      features: MagicSquareDifficultyFeatures;
      listAlternativeReadings: () => Iterable<MagicSquareAlternativeReading>;
    }
  | {
      status: "invalid";
      reason: "no-solution" | "multiple-solutions" | "search-capped";
    };

export function analyzeMagicSquareDifficulty(
  size: number,
  givens: MagicSquareGrid,
): MagicSquareDifficultyAnalysis {
  const search = countMagicSquareSolutions(size, givens, {
    limit: 2,
    nodeCap: MAGIC_SQUARE_SOLUTION_SEARCH_NODE_CAP,
  });
  if (search.capped) {
    return { status: "invalid", reason: "search-capped" };
  }
  if (search.count !== 1) {
    return {
      status: "invalid",
      reason: search.count === 0 ? "no-solution" : "multiple-solutions",
    };
  }
  const reading = measureMagicSquareReading(size, givens);
  const givenCount = givens.filter(Boolean).length;
  return {
    status: "analyzed",
    features: {
      boardSize: size,
      givenCount,
      emptyCellCount: givens.length - givenCount,
      reading,
      virtualReading: measureMagicSquareVirtualReading(size, givens),
      tier1Minimal:
        reading.status === "solved" &&
        reading.tierMax === 1 &&
        isMagicSquareTier1Minimal(size, givens),
      solutionSearchNodeCount: search.nodes,
    },
    *listAlternativeReadings() {
      for (const { id, options } of listMagicSquareAlternativeReadings()) {
        yield {
          id,
          features: measureMagicSquareReading(size, givens, options),
          measureVirtual: () =>
            measureMagicSquareVirtualReading(size, givens, options),
        };
      }
    },
  };
}
