import {
  assessHakoiriMusumeDifficulty,
  classifyHakoiriMusumeFeatures,
  hakoiriMusumeLevelCriteria,
  hakoiriMusumeOptimalMoveCountRange,
} from "@/games/hakoiri-musume/difficulty";
import reference from "@/games/hakoiri-musume/problem/generation/research-reference.json";

/** 調査コードの範囲の書き方（上限のない範囲は 99）を、基準表の書き方にする。 */
function toRange([minimum, maximum]: readonly number[]) {
  return {
    minimum: minimum!,
    maximum: maximum === 99 ? Number.POSITIVE_INFINITY : maximum!,
  };
}

describe("hakoiriMusumeLevelCriteria", () => {
  const { criteria } = reference;

  test("調査で決めた案 E の基準表と同じ範囲であること", () => {
    const fromResearch = Object.fromEntries(
      Object.keys(criteria.prep).map((level) => [
        level,
        {
          preparationLength: toRange(
            criteria.prep[level as keyof typeof criteria.prep],
          ),
          daughterDetourCount: toRange(
            criteria.bmin[level as keyof typeof criteria.bmin],
          ),
          emptyCellCount: toRange(
            criteria.empties[level as keyof typeof criteria.empties],
          ),
        },
      ]),
    );

    expect(hakoiriMusumeLevelCriteria).toEqual(fromResearch);
    expect(hakoiriMusumeOptimalMoveCountRange).toEqual({
      minimum: criteria.opt_floor,
      maximum: criteria.opt_ceil,
    });
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
        preparationLength: 20,
        daughterDetourCount: 3,
        emptyCellCount: 2,
      },
      { status: "out-of-range", reason: "too-long" },
    ],
    [
      "準備4手・遠回り1回・空き4",
      {
        optimalMoveCount: 13,
        preparationLength: 4,
        daughterDetourCount: 1,
        emptyCellCount: 4,
      },
      { status: "classified", difficulty: "1" },
    ],
    [
      "準備5手だが遠回りが無い",
      {
        optimalMoveCount: 15,
        preparationLength: 5,
        daughterDetourCount: 0,
        emptyCellCount: 4,
      },
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "準備12手で空き4",
      {
        optimalMoveCount: 40,
        preparationLength: 12,
        daughterDetourCount: 2,
        emptyCellCount: 4,
      },
      { status: "out-of-range", reason: "unlisted-combination" },
    ],
    [
      "準備25手・遠回り3回・空き2（横刀立馬）",
      {
        optimalMoveCount: 81,
        preparationLength: 25,
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
