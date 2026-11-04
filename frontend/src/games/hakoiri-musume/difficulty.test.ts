import {
  assessHakoiriMusumeDifficulty,
  classifyHakoiriMusumeFeatures,
  hakoiriMusumeLevelCriteria,
  hakoiriMusumeOptimalMoveCountRange,
} from "@/games/hakoiri-musume/difficulty";
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

  test("調査で決めた案 F の基準表と同じ範囲であること", () => {
    const fromResearch = Object.fromEntries(
      Object.entries(criteria.levels).map(([level, ranges]) => [
        level,
        {
          preparationLength: toRange(ranges.preparationLength),
          daughterDetourCount: toRange(ranges.daughterDetourCount),
          emptyCellCount: toRange(ranges.emptyCellCount),
        },
      ]),
    );

    expect(hakoiriMusumeLevelCriteria).toEqual(fromResearch);
    expect(hakoiriMusumeOptimalMoveCountRange).toEqual(
      toRange(criteria.optimalMoveCount),
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
        daughterDetourCount: 3,
        emptyCellCount: 2,
      },
      { status: "out-of-range", reason: "too-long" },
    ],
    [
      "準備6手・遠回り0回・空き4（合意の易しい例）",
      {
        optimalMoveCount: 13,
        preparationLength: 6,
        daughterDetourCount: 0,
        emptyCellCount: 4,
      },
      { status: "classified", difficulty: "1" },
    ],
    [
      "準備6手だが遠回りが1回ある",
      {
        optimalMoveCount: 15,
        preparationLength: 6,
        daughterDetourCount: 1,
        emptyCellCount: 4,
      },
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "準備16手で空き5",
      {
        optimalMoveCount: 30,
        preparationLength: 16,
        daughterDetourCount: 1,
        emptyCellCount: 5,
      },
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "準備30手・遠回り2回・空き2（横刀立馬）",
      {
        optimalMoveCount: 81,
        preparationLength: 30,
        daughterDetourCount: 2,
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
