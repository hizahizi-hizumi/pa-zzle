import {
  assessBridgesDifficulty,
  type BridgesAssessedFeatures,
  bridgesLevelCombinations,
  bridgesLevelReadings,
  listBridgesGenerationConditions,
} from "@/games/bridges/difficulty";
import type { BridgesDifficultyAnalysis } from "@/games/bridges/problem/difficulty-analysis";
import { difficultyLevels } from "@/games/difficulty";

function createAnalysis(
  features: BridgesAssessedFeatures,
): BridgesDifficultyAnalysis {
  const {
    boardSize,
    islandCount,
    countRoundCount,
    connectivityRoundCount,
    lookaheadRoundCount,
    passageRoundCount,
    groupClosureRoundCount,
  } = features;
  return {
    status: "analyzed",
    requiresTrial: false,
    scale: {
      size: boardSize,
      islandCount,
      edgeCount: 30,
      bridgeCount: 25,
      clueMean: features.clueMean,
      highClueCount: features.highClueCount,
      dominantClueShare: features.dominantClueShare,
      doubleBridgeRatio: features.doubleBridgeRatio,
      loopCount: 1,
    },
    reasoning: {
      maximumTier:
        lookaheadRoundCount > 0
          ? "D"
          : connectivityRoundCount > 0
            ? "C1g"
            : countRoundCount > 0
              ? "A2"
              : "A1",
      countRoundCount,
      connectivityRoundCount,
      roundCountByTier: {
        A1: 1,
        A2: countRoundCount,
        C1p: 0,
        C1g: groupClosureRoundCount,
        C3: passageRoundCount,
        D: lookaheadRoundCount,
        T: 0,
      },
      countReasoningUndecidedRatio: features.countReasoningUndecidedRatio,
      openingEdgeRatio: features.openingEdgeRatio,
      openingSaturatedIslandCount: features.openingSaturatedIslandCount,
      closureRoundCount: features.closureRoundCount,
      sweepRoundCount: 0,
      groupClosureRoundCount,
      lookaheadRoundCount,
      passageRoundCount,
    },
    trial: {
      medianBacktrackCount: 0,
      medianDisconnectedFullCount: 0,
      firstTrySolvedRatio: 1,
    },
  };
}

const level1: BridgesAssessedFeatures = {
  boardSize: 6,
  islandCount: 9,
  openingEdgeRatio: 0.6,
  countRoundCount: 0,
  connectivityRoundCount: 0,
  countReasoningUndecidedRatio: 0,
  openingSaturatedIslandCount: 2,
  closureRoundCount: 0,
  groupClosureRoundCount: 0,
  passageRoundCount: 0,
  lookaheadRoundCount: 0,
  clueMean: 2.9,
  highClueCount: 2,
  dominantClueShare: 0.4,
  doubleBridgeRatio: 0.45,
};

const level2: BridgesAssessedFeatures = {
  ...level1,
  boardSize: 7,
  islandCount: 13,
  openingEdgeRatio: 0.4,
  countRoundCount: 2,
};

const level3: BridgesAssessedFeatures = {
  ...level2,
  boardSize: 8,
  islandCount: 17,
  connectivityRoundCount: 1,
  countReasoningUndecidedRatio: 0.5,
  closureRoundCount: 1,
  groupClosureRoundCount: 1,
};

const level4: BridgesAssessedFeatures = {
  ...level3,
  boardSize: 10,
  islandCount: 22,
  connectivityRoundCount: 2,
  lookaheadRoundCount: 1,
};

const level5: BridgesAssessedFeatures = {
  ...level4,
  islandCount: 27,
  countRoundCount: 3,
  connectivityRoundCount: 3,
  lookaheadRoundCount: 2,
};

describe("assessBridgesDifficulty", () => {
  test.each([
    [
      "見ただけで決め打ちでき、数字のちょうどの読みだけで決まる 6×6",
      level1,
      "1",
    ],
    ["決め打ちの後、少なくとも1本の読みが2回要る 7×7", level2, "2"],
    ["3島以上の組を閉じない読みが1か所要る 8×8", level3, "3"],
    ["閉じない読みに加えて、1手の先読みが1回要る島22の 10×10", level4, "4"],
    ["1手の先読みが2回要る島27の 10×10", level5, "5"],
  ] as const)("%sをレベル %s にすること", (_, features, expected) => {
    const assessment = assessBridgesDifficulty(createAnalysis(features));

    expect(assessment).toMatchObject({
      status: "classified",
      difficulty: expected,
    });
  });

  test.each([
    ["入口が全部の 6×6", { ...level1, openingEdgeRatio: 1 }],
    ["島が6つの 6×6", { ...level1, islandCount: 6 }],
    ["決め打ちの無い 6×6", { ...level1, openingSaturatedIslandCount: 0 }],
    ["数字の平均が 2.5 の 6×6", { ...level1, clueMean: 2.5 }],
    ["半分を超える島が同じ数字の 6×6", { ...level1, dominantClueShare: 0.55 }],
    ["2本の組が2割の 6×6", { ...level1, doubleBridgeRatio: 0.2 }],
    ["少なくとも1本の読みが1回だけの 7×7", { ...level2, countRoundCount: 1 }],
    [
      "3島以上の組を閉じない読みが要る 7×7",
      { ...level2, connectivityRoundCount: 1, groupClosureRoundCount: 1 },
    ],
    [
      "つながりの読みが、多くの組をまとめて決める手詰まりだけの 8×8",
      { ...level3, closureRoundCount: 0 },
    ],
    ["1手の先読みが要る 8×8", { ...level3, lookaheadRoundCount: 1 }],
    ["大きい数字の島が無い 10×10", { ...level4, highClueCount: 0 }],
    [
      "1手の先読みが1回だけで、島が27の 10×10",
      { ...level5, lookaheadRoundCount: 1 },
    ],
    ["1手の先読みが2回要るが、島が22の 10×10", { ...level5, islandCount: 22 }],
  ] as const)("%sを組み合わせ外にすること", (_, features) => {
    const assessment = assessBridgesDifficulty(createAnalysis(features));

    expect(assessment).toMatchObject({
      status: "out-of-range",
      reason: "unlisted-combination",
    });
  });

  const scale = {
    size: 10,
    islandCount: 20,
    edgeCount: 30,
    bridgeCount: 25,
    clueMean: 2.9,
    highClueCount: 2,
    dominantClueShare: 0.4,
    doubleBridgeRatio: 0.45,
    loopCount: 1,
  };

  test.each([
    [
      "試し置きが要る",
      { status: "analyzed", requiresTrial: true, scale },
      { status: "out-of-range", reason: "requires-trial" },
    ],
    [
      "試し置きでも決まらない",
      { status: "unsupported", scale },
      { status: "unsupported" },
    ],
    [
      "解が2つ以上ある",
      { status: "invalid", reason: "multiple-solutions" },
      { status: "invalid" },
    ],
  ] as const)("%s問題を状態で分けて返すこと", (_, analysis, expected) => {
    const assessment = assessBridgesDifficulty(analysis);

    expect(assessment).toEqual(expected);
  });
});

describe("bridgesLevelCombinations", () => {
  const pairs = difficultyLevels
    .slice(1)
    .map(({ id }, index) => [
      bridgesLevelCombinations[difficultyLevels[index]!.id],
      bridgesLevelCombinations[id],
    ]);

  const raisingSystems = [
    "boardSize",
    "islandCount",
    "countRoundCount",
    "connectivityRoundCount",
    "countReasoningUndecidedRatio",
  ] as const;

  test("上のレベルほど、盤面・島の数・少なくとも1本の読み・つながり・数字で決まらない割合の下限を下げないこと", () => {
    const lowered = pairs.flatMap(([lower, upper]) =>
      raisingSystems.filter((key) => upper![key].minimum < lower![key].minimum),
    );

    expect(lowered).toEqual([]);
  });

  test("上のレベルほど、入口の広さの上限を上げないこと", () => {
    const raised = pairs.filter(
      ([lower, upper]) =>
        upper!.openingEdgeRatio.maximum > lower!.openingEdgeRatio.maximum,
    );

    expect(raised).toEqual([]);
  });

  test("隣のレベルと盤面の一辺を1つ共有すること", () => {
    const shared = pairs.map(
      ([lower, upper]) => lower!.boardSize.maximum === upper!.boardSize.minimum,
    );

    expect(shared).toEqual([true, true, true, true]);
  });

  test("レベル4 と 5 を島の数で重ならずに分けること", () => {
    const four = bridgesLevelCombinations["4"].islandCount;
    const five = bridgesLevelCombinations["5"].islandCount;

    expect(four.maximum).toBeLessThan(five.minimum);
  });
});

describe("bridgesLevelReadings", () => {
  const pairs = difficultyLevels
    .slice(1)
    .map(({ id }, index) => [
      bridgesLevelReadings[difficultyLevels[index]!.id],
      bridgesLevelReadings[id],
    ]);

  test("上のレベルほど、閉じない読み・1手の先読み・大きい数字の下限を下げないこと", () => {
    const lowered = pairs.flatMap(([lower, upper]) =>
      (
        ["closureRoundCount", "lookaheadRoundCount", "highClueCount"] as const
      ).filter((key) => upper![key].minimum < lower![key].minimum),
    );

    expect(lowered).toEqual([]);
  });

  test("レベル4 と 5 には、閉じない読みと1手の先読みを必ず求めること", () => {
    const required = (["4", "5"] as const).map((id) => [
      bridgesLevelReadings[id].closureRoundCount.minimum,
      bridgesLevelReadings[id].lookaheadRoundCount.minimum,
    ]);

    expect(required).toEqual([
      [1, 1],
      [1, 2],
    ]);
  });

  test("レベル1 と 2 には、解き始めの決め打ちを必ず求めること", () => {
    const minimums = (["1", "2"] as const).map(
      (id) => bridgesLevelReadings[id].openingSaturatedIslandCount.minimum,
    );

    expect(minimums).toEqual([1, 1]);
  });
});

describe("listBridgesGenerationConditions", () => {
  test("レベルの盤面の範囲の大きさだけを挙げること", () => {
    const sizes = difficultyLevels.map(({ id }) => [
      ...new Set(listBridgesGenerationConditions(id).map(({ size }) => size)),
    ]);

    expect(sizes).toEqual([[6, 7], [7, 8], [8, 9], [9, 10], [10]]);
  });

  test("密度・2本の割合・輪の割合・分割の全ての組を、レベルに当たりやすい磨く回数で挙げること", () => {
    const conditions = listBridgesGenerationConditions("5");
    const refinements = [
      ...new Set(conditions.map(({ refinementSteps }) => refinementSteps)),
    ];

    expect(conditions).toHaveLength(16);
    expect(refinements).toEqual([1500]);
  });
});
