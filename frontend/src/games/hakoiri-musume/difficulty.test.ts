import {
  assessHakoiriMusumeDifficulty,
  classifyHakoiriMusumeFeatures,
  hakoiriMusumeLevelCriteria,
  hakoiriMusumeOptimalMoveCountRange,
} from "@/games/hakoiri-musume/difficulty";
import { HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT } from "@/games/hakoiri-musume/problem/daughter-detour";
import reference from "@/games/hakoiri-musume/problem/generation/research-reference.json";

/** 調査コードの範囲の書き方（上限のない範囲は `null`）を、基準表の書き方にする。 */
function toRange([minimum, maximum]: readonly (number | null)[]) {
  return {
    minimum: minimum!,
    maximum: maximum ?? Number.POSITIVE_INFINITY,
  };
}

describe("hakoiriMusumeLevelCriteria", () => {
  const { criteria } = reference;

  test("調査で決めた案 I の基準表と同じ範囲であること", () => {
    const fromResearch = Object.fromEntries(
      Object.entries(criteria.levels).map(([level, ranges]) => [
        level,
        {
          preparationLength: toRange(ranges.preparationLength),
          daughterDetourCount: toRange(ranges.daughterDetourCount),
          emptyCellCount: toRange(ranges.emptyCellCount),
          maximumShortestPreparationShare:
            ranges.maximumShortestPreparationShare,
        },
      ]),
    );

    expect(hakoiriMusumeLevelCriteria).toEqual(fromResearch);
    expect(hakoiriMusumeOptimalMoveCountRange).toEqual(
      toRange(criteria.optimalMoveCount),
    );
  });
});

describe("HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT", () => {
  test("基準表の遠回りの上限のうち、上限の無いものを除いた最大であること", () => {
    const finiteMaximums = Object.values(hakoiriMusumeLevelCriteria).flatMap(
      ({ daughterDetourCount: { maximum } }) =>
        Number.isFinite(maximum) ? [maximum] : [],
    );

    expect(HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT).toBe(
      Math.max(...finiteMaximums),
    );
  });
});

describe("classifyHakoiriMusumeFeatures", () => {
  const cases = [
    [
      "最短7手",
      {
        optimalMoveCount: 7,
        preparationLength: 3,
        shortestPreparationLength: 3,
        daughterDetourCount: 0,
        emptyCellCount: 6,
      },
      { status: "out-of-range", reason: "too-light" },
    ],
    [
      "最短91手",
      {
        optimalMoveCount: 91,
        preparationLength: 40,
        shortestPreparationLength: 40,
        daughterDetourCount: 3,
        emptyCellCount: 2,
      },
      { status: "out-of-range", reason: "too-long" },
    ],
    [
      "準備6手・遠回り1回・空き4（合意の易しい例）",
      {
        optimalMoveCount: 13,
        preparationLength: 6,
        shortestPreparationLength: 9,
        daughterDetourCount: 1,
        emptyCellCount: 4,
      },
      { status: "classified", difficulty: "1" },
    ],
    [
      "準備6手だが遠回りが2回ある",
      {
        optimalMoveCount: 15,
        preparationLength: 6,
        shortestPreparationLength: 6,
        daughterDetourCount: 2,
        emptyCellCount: 4,
      },
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "準備16手で空き5",
      {
        optimalMoveCount: 30,
        preparationLength: 16,
        shortestPreparationLength: 16,
        daughterDetourCount: 1,
        emptyCellCount: 5,
      },
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "準備9手・最短11手で、最短の解の準備10手（最短の解の 0.91）はレベル2 に出さない",
      {
        optimalMoveCount: 11,
        preparationLength: 9,
        shortestPreparationLength: 10,
        daughterDetourCount: 1,
        emptyCellCount: 4,
      },
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "準備25手・最短30手で、最短の解の準備26手（0.87）はレベル4",
      {
        optimalMoveCount: 30,
        preparationLength: 25,
        shortestPreparationLength: 26,
        daughterDetourCount: 1,
        emptyCellCount: 2,
      },
      { status: "classified", difficulty: "4" },
    ],
    [
      "準備25手・最短28手で、最短の解の準備25手（0.89）はレベル4 に出さない",
      {
        optimalMoveCount: 28,
        preparationLength: 25,
        shortestPreparationLength: 25,
        daughterDetourCount: 1,
        emptyCellCount: 2,
      },
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "準備40手・遠回り3回・空き2（横刀立馬）",
      {
        optimalMoveCount: 81,
        preparationLength: 40,
        shortestPreparationLength: 40,
        daughterDetourCount: 3,
        emptyCellCount: 2,
      },
      { status: "classified", difficulty: "5" },
    ],
  ] as const;

  test.each(cases)(
    "準備の長さでレベルを決め、遠回りと空きの範囲を確かめること: %s",
    (_, features, expected) => {
      const assessment = classifyHakoiriMusumeFeatures(features);

      expect(assessment).toEqual(expected);
    },
  );
});

describe("assessHakoiriMusumeDifficulty", () => {
  test("娘を出口の前へ運べない問題を成立しない問題とすること", () => {
    const assessment = assessHakoiriMusumeDifficulty({
      status: "invalid",
      reason: "unreachable-exit",
    });

    expect(assessment).toEqual({
      status: "invalid",
      reason: "unreachable-exit",
    });
  });
});
