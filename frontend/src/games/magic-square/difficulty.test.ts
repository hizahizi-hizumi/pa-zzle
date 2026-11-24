import {
  assessMagicSquareDifficulty,
  classifyMagicSquareReading,
  classifyMagicSquareReadingOnBoard,
  findMagicSquareDisagreeingReading,
  hasMagicSquareDeepPlace,
  isInMagicSquareLevelBand,
  isMagicSquareFirstPlaceDeep,
  MAGIC_SQUARE_SWEEP_LIMIT,
} from "@/games/magic-square/difficulty";
import {
  analyzeMagicSquareDifficulty,
  type MagicSquareDifficultyAnalysis,
  type MagicSquareReadingFeatures,
  measureMagicSquareReading,
  measureMagicSquareVirtualReading,
} from "@/games/magic-square/problem/difficulty-analysis";
import reference from "@/games/magic-square/problem/generation/difficulty-reference.json";
import { magicSquareReadingParts } from "@/games/magic-square/problem/generation/reading-parts";
import type { MagicSquareGrid } from "@/games/magic-square/problem/generation/solver";

// 期待値は docs/パズル/導入調査/魔方陣/調査コード/magic_square_difficulty.py（版 8）の level_v6_raw・single_level_v6・
// band_reason・classify_v6 と、部品の2つ・3つの組み合わせで基準とレベルが違った最初の組（agreement_combos）。
// レベルの文字列は部品の並びで、レベルが無ければ `-`。

type ReferenceCase = (typeof reference.cases)[number];

const cases = reference.cases.map((entry) => [entry.id, entry] as const);

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

function toLevelNumber(level: string | null): number | null {
  return level === null ? null : Number(level);
}

function toLevelMark(level: string | null): string {
  return level ?? "-";
}

function findFeatureValue(entry: ReferenceCase, key: string): number {
  return entry.features[reference.featureKeys.indexOf(key)]!;
}

const baseFeatures: MagicSquareReadingFeatures = {
  status: "solved",
  entryCellCount: 0,
  firstTier: 2,
  firstSweeps: 1,
  tierMax: 2,
  placeCount: 4,
  stuckPlaceCount: 2,
  tier3PlaceCount: 0,
  tier2SweepsMax: 1,
  tier3SweepsMax: 0,
  stuckSweepsMax: 1,
  stuckSweepTotal: 2,
  reworkedPlaceCount: 0,
  threeSweepPlaceCount: 0,
  hiddenOnlyPlaceCount: 0,
  lockPlaceCount: 0,
  chainLineCountMax: 0,
  combinationCountMedian: 2,
  combinationCountMax: 3,
};

describe("classifyMagicSquareReading", () => {
  const ladderCases = [
    [
      "段1だけで解ければレベル1",
      { entryCellCount: 3, firstTier: 1, tierMax: 1, tier2SweepsMax: 0 },
      { level: "1" },
    ],
    [
      "入口があり、深い所が無ければレベル2",
      { entryCellCount: 2, firstTier: 1 },
      { level: "2" },
    ],
    ["入口が無く、深い所が無ければレベル3", {}, { level: "3" }],
    [
      "入口が無く、途中に段2で3巡の所があればレベル4",
      { tier2SweepsMax: 3, stuckSweepsMax: 3 },
      { level: "4" },
    ],
    [
      "入口が無く、最初の所が段3ならレベル5",
      { firstTier: 3, tierMax: 3, tier3PlaceCount: 1, tier3SweepsMax: 1 },
      { level: "5" },
    ],
    [
      "入口があって深い所もあればどのレベルにも当たらない",
      { entryCellCount: 1, firstTier: 1, tierMax: 3, tier3PlaceCount: 1 },
      { level: null, reason: "unlisted-combination" },
    ],
    [
      "段4が要れば long-line",
      { tierMax: 4 },
      { level: null, reason: "long-line" },
    ],
    [
      "巡が上限を超えれば too-deep",
      { tier2SweepsMax: 5, stuckSweepsMax: 5 },
      { level: null, reason: "too-deep" },
    ],
    [
      "読み切れなければ requires-trial",
      { status: "stuck" },
      { level: null, reason: "requires-trial" },
    ],
  ] as const;

  test.each(ladderCases)("%s", (_, overrides, expected) => {
    const result = classifyMagicSquareReading(
      { ...baseFeatures, ...overrides },
      MAGIC_SQUARE_SWEEP_LIMIT,
    );

    expect(result).toEqual(expected);
  });

  describe("巡の上限を当てない場合", () => {
    const deep = {
      ...baseFeatures,
      firstSweeps: 5,
      tier2SweepsMax: 5,
      stuckSweepsMax: 5,
    };

    test("巡が上限を超えてもレベルを付けること", () => {
      const result = classifyMagicSquareReading(deep, null);

      expect(result).toEqual({ level: "5" });
    });
  });
});

describe("hasMagicSquareDeepPlace・isMagicSquareFirstPlaceDeep", () => {
  test.each(cases)(
    "%s の深い所と最初の所が深いかが調査コードと同じこと",
    (_, entry) => {
      const { reading } = analyzeValidProblem(
        entry.size,
        entry.givens,
      ).features;

      expect({
        deep: Number(hasMagicSquareDeepPlace(reading)),
        firstDeep: Number(isMagicSquareFirstPlaceDeep(reading)),
      }).toEqual({
        deep: findFeatureValue(entry, "is_vdeep"),
        firstDeep: findFeatureValue(entry, "first_vdeep"),
      });
    },
  );
});

describe("classifyMagicSquareReadingOnBoard", () => {
  test.each(cases)(
    "%s の基準のレベルと作るときの帯と仮想の列を足したレベルが調査コードと同じこと",
    (_, entry) => {
      const { features } = analyzeValidProblem(entry.size, entry.givens);
      const { level } = classifyMagicSquareReadingOnBoard(
        features.reading,
        () => features.virtualReading,
        { sweepLimit: MAGIC_SQUARE_SWEEP_LIMIT, boardSize: entry.size },
      );
      const virtualLevel =
        features.virtualReading === null
          ? null
          : classifyMagicSquareReading(
              features.virtualReading,
              MAGIC_SQUARE_SWEEP_LIMIT,
            ).level;

      expect({
        level: toLevelNumber(level),
        band:
          level === null || isInMagicSquareLevelBand(features.reading, level)
            ? null
            : "near-boundary",
        virtualLevel: toLevelNumber(virtualLevel),
      }).toEqual({
        level: entry.singleLevel,
        band: entry.band,
        virtualLevel: entry.virtualLevel,
      });
    },
  );

  test.each(cases)(
    "%s を34の部品で読んだレベル（巡の上限を当てない）が調査コードと同じこと",
    (_, entry) => {
      const levels = magicSquareReadingParts.map(({ options }) => {
        const reading = measureMagicSquareReading(
          entry.size,
          entry.givens,
          options,
        );
        const measureVirtual = () =>
          measureMagicSquareVirtualReading(entry.size, entry.givens, options);
        const { level } = classifyMagicSquareReadingOnBoard(
          reading,
          measureVirtual,
          { sweepLimit: null, boardSize: entry.size },
        );
        const virtual = measureVirtual();
        return {
          level: toLevelMark(level),
          virtualLevel:
            virtual === null
              ? ""
              : toLevelMark(classifyMagicSquareReading(virtual, null).level),
        };
      });

      expect({
        levels: levels.map(({ level }) => level).join(""),
        virtualLevels: levels.map(({ virtualLevel }) => virtualLevel).join(""),
      }).toEqual({
        levels: entry.partLevels,
        virtualLevels: entry.partVirtualLevels ?? "",
      });
    },
  );
});

describe("findMagicSquareDisagreeingReading", () => {
  // 部品の全部で一致し、組み合わせの途中で違うレベルになる候補のうち、確かめる組み合わせが少ないもの。
  const MAXIMUM_CHECKED_COMBINATIONS = 500;
  const disagreeingCases = cases.filter(
    ([, entry]) =>
      entry.combinations !== null &&
      entry.combinations.firstDisagreeing !== null &&
      entry.combinations.checked <= MAXIMUM_CHECKED_COMBINATIONS,
  );

  test.each(disagreeingCases)(
    "%s で基準と違うレベルになる最初の組み合わせが調査コードと同じこと",
    (_, entry) => {
      const analysis = analyzeValidProblem(entry.size, entry.givens);
      const { level } = classifyMagicSquareReadingOnBoard(
        analysis.features.reading,
        () => analysis.features.virtualReading,
        { sweepLimit: MAGIC_SQUARE_SWEEP_LIMIT, boardSize: null },
      );
      if (level === null) {
        throw new Error(`Unexpected unleveled problem: ${entry.id}`);
      }

      const readingId = findMagicSquareDisagreeingReading(analysis, level);

      expect(readingId).toBe(entry.combinations?.firstDisagreeing);
    },
  );
});

describe("assessMagicSquareDifficulty", () => {
  // 部品の組み合わせを全部確かめる前に決まる候補と、組み合わせの全部で一致する候補のうち読むのが軽いもの。
  // ほかの範囲内の候補は scripts/analyze-magic-square-difficulty.ts の reference で確かめる。
  const lightClassifiedIds = new Set(["ms4-T1-k0-1", "ms5-T2-k1-13"]);
  const assessedCases = cases.filter(
    ([, entry]) =>
      entry.combinations === null ||
      (entry.combinations.firstDisagreeing !== null &&
        entry.combinations.checked <= 500) ||
      lightClassifiedIds.has(entry.id),
  );

  test.each(assessedCases)(
    "%s のレベルと範囲外の理由が調査コードと同じこと",
    (_, entry) => {
      const analysis = analyzeMagicSquareDifficulty(entry.size, entry.givens);

      const assessment = assessMagicSquareDifficulty(analysis);

      expect({
        level:
          assessment.status === "classified"
            ? Number(assessment.difficulty)
            : null,
        reason: assessment.status === "out-of-range" ? assessment.reason : null,
      }).toEqual({ level: entry.level, reason: entry.reason });
    },
  );

  describe("答えが2つ以上ある場合", () => {
    const analysis = analyzeMagicSquareDifficulty(4, Array(16).fill(0));

    test("成立しない問題とすること", () => {
      const assessment = assessMagicSquareDifficulty(analysis);

      expect(assessment).toEqual({ status: "invalid" });
    });
  });
});
