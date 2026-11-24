import {
  analyzeMagicSquareDifficulty,
  isMagicSquareTier1Minimal,
  type MagicSquareDifficultyAnalysis,
  type MagicSquareReadingFeatures,
} from "@/games/magic-square/problem/difficulty-analysis";
import reference from "@/games/magic-square/problem/generation/difficulty-reference.json";
import type { MagicSquareGrid } from "@/games/magic-square/problem/generation/solver";

// 期待値は docs/パズル/導入調査/魔方陣/調査コード/magic_square_difficulty.py（版 8）の read_features と count_solutions。
// difficulty-reference.json の features は featureKeys の並び。

/** 調査コードの特徴の名前と、製品の特徴の名前。 */
const readingFeatureKeys = {
  entry: "entryCellCount",
  first_tier: "firstTier",
  first_sweeps: "firstSweeps",
  tier_max: "tierMax",
  d2max: "tier2SweepsMax",
  d3max: "tier3SweepsMax",
  depth_max: "stuckSweepsMax",
  t3: "tier3PlaceCount",
  hard: "stuckPlaceCount",
  deep: "reworkedPlaceCount",
  deep3: "threeSweepPlaceCount",
  lock: "lockPlaceCount",
  hidden: "hiddenOnlyPlaceCount",
  chain_max: "chainLineCountMax",
  combos_med: "combinationCountMedian",
  combos_max: "combinationCountMax",
} as const satisfies Record<string, keyof MagicSquareReadingFeatures>;

/** 版 8 の深い所（`first_vdeep`・`is_vdeep`）は分類の方針なので、difficulty.test.ts で比べる。 */
const featureKeysOutsideAnalysis = new Set(["first_vdeep", "is_vdeep"]);

/** 答えが1つの問題を解析する。調査の候補はどれも答えが1つ。 */
function analyzeValidProblem(
  size: number,
  givens: MagicSquareGrid,
): Extract<MagicSquareDifficultyAnalysis, { status: "analyzed" }> {
  const analysis = analyzeMagicSquareDifficulty(size, givens);
  if (analysis.status !== "analyzed") {
    throw new Error(`Unexpected invalid problem: ${givens.join(".")}`);
  }
  return analysis;
}

function toReferenceFeatures(
  boardSize: number,
  givenCount: number,
  emptyCellCount: number,
  reading: MagicSquareReadingFeatures,
): Record<string, number> {
  return {
    n: boardSize,
    givens: givenCount,
    empties: emptyCellCount,
    // 段2で2巡以上を深いとした前の版の量と、段1だけで解ける問題の所の数。製品は持たないので、調査コードの定義で求める。
    first_hard: Number(
      reading.firstTier >= 3 ||
        (reading.firstTier === 2 && reading.firstSweeps >= 2),
    ),
    is_deep: Number(
      reading.tier2SweepsMax >= 2 || reading.tier3PlaceCount >= 1,
    ),
    t1depth: reading.tierMax === 1 ? reading.placeCount : 0,
    ...Object.fromEntries(
      Object.entries(readingFeatureKeys).map(([researchKey, key]) => [
        researchKey,
        reading[key],
      ]),
    ),
  };
}

describe("analyzeMagicSquareDifficulty", () => {
  const cases = reference.cases.map((entry) => [entry.id, entry] as const);

  test.each(cases)(
    "%s の基準の読みの特徴と答えを数えた節点の数が調査コードと同じこと",
    (_, entry) => {
      const { features } = analyzeValidProblem(entry.size, entry.givens);

      expect({
        features: toReferenceFeatures(
          features.boardSize,
          features.givenCount,
          features.emptyCellCount,
          features.reading,
        ),
        nodes: features.solutionSearchNodeCount,
      }).toEqual({
        features: Object.fromEntries(
          reference.featureKeys
            .map((key, index) => [key, entry.features[index]] as const)
            .filter(([key]) => !featureKeysOutsideAnalysis.has(key)),
        ),
        nodes: entry.solutionSearchNodes,
      });
    },
  );

  // 調査コードは L1 の盤面（4×4）だけで段1での極小を測った。
  const fourByFourCases = cases.filter(([, entry]) => entry.size === 4);

  test.each(fourByFourCases)(
    "%s の段1での極小が調査コードと同じこと",
    (_, entry) => {
      const { features } = analyzeValidProblem(entry.size, entry.givens);

      expect(features.tier1Minimal).toBe(entry.tier1Minimal);
    },
  );

  describe("部品とその組み合わせの読み", () => {
    const [, entry] = cases[0]!;

    test("部品の並びの順に1つずつ読むこと", () => {
      const iterator = analyzeValidProblem(entry.size, entry.givens)
        .listAlternativeReadings()
        [Symbol.iterator]();
      const first = iterator.next().value;
      const second = iterator.next().value;

      expect([first?.id, second?.id]).toEqual(["carry", "cum"]);
    });
  });

  describe("答えが無い場合", () => {
    const givens = [1, 2, 3, 0, ...Array(12).fill(0)];

    test("成立しない問題とすること", () => {
      const analysis = analyzeMagicSquareDifficulty(4, givens);

      expect(analysis).toEqual({ status: "invalid", reason: "no-solution" });
    });
  });

  describe("答えが2つ以上ある場合", () => {
    const givens = Array(16).fill(0);

    test("成立しない問題とすること", () => {
      const analysis = analyzeMagicSquareDifficulty(4, givens);

      expect(analysis).toEqual({
        status: "invalid",
        reason: "multiple-solutions",
      });
    });
  });
});

describe("isMagicSquareTier1Minimal", () => {
  // 段1まで読むモデルで空けられるだけ空け、戻さずに作った候補。
  const reducedByTier1 = reference.cases
    .filter(({ maxTier, addBack }) => maxTier === 1 && addBack === 0)
    .map((entry) => [entry.id, entry] as const);
  // 段1で極小にしてから1マスを戻した候補。
  const addedBack = reference.cases
    .filter(({ maxTier, addBack }) => maxTier === 1 && addBack > 0)
    .map((entry) => [entry.id, entry] as const);

  test.each(reducedByTier1)("%s を極小とすること", (_, entry) => {
    const result = isMagicSquareTier1Minimal(entry.size, entry.givens);

    expect(result).toBe(true);
  });

  test.each(addedBack)("%s を極小としないこと", (_, entry) => {
    const result = isMagicSquareTier1Minimal(entry.size, entry.givens);

    expect(result).toBe(false);
  });
});
