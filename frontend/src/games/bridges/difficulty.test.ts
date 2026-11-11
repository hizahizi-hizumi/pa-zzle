import {
  assessBridgesDifficulty,
  type BridgesAssessedFeatures,
  bridgesLevelCombinations,
  bridgesLevelReadings,
  bridgesLevelStructures,
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
      veryHighClueCount: features.veryHighClueCount,
      maximumClue: 6,
      dominantClueShare: features.dominantClueShare,
      twoClueShare: features.twoClueShare,
      doubleBridgeRatio: features.doubleBridgeRatio,
      loopCount: features.loopCount,
      borderBridgeShare: features.borderBridgeShare,
      longBridgeShare: 0.2,
      usedEdgeShare: features.usedEdgeShare,
      islandShare: features.islandShare,
      diagonalNeighborShare: features.diagonalNeighborShare,
      shortBridgeShare: features.shortBridgeShare,
      longBridgeCount: features.longBridgeCount,
      pointSymmetric: 0,
      borderIslandShare: features.borderIslandShare,
      gridAlignmentShare: 0.3,
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
      readingRoundCount: features.readingRoundCount,
      groupLookaheadRoundCount: features.groupLookaheadRoundCount,
      chainedLookaheadRoundCount: features.chainedLookaheadRoundCount,
      crossingBlockCount: features.crossingBlockCount,
      cornerOpeningIslandCount: 0,
      countLookaheadRoundCount: features.countLookaheadRoundCount,
      cappingLookaheadRoundCount: 0,
      isolatingLookaheadRoundCount: 0,
      lookaheadSpotCount: features.lookaheadSpotCount,
      longestLookaheadChain: features.longestLookaheadChain,
      readingCappingLookaheadRoundCount: 0,
      lastConnectivityDecidedRatio: features.lastConnectivityDecidedRatio,
      firstLookaheadDecidedRatio: 0.5,
      lookaheadReasonKindCount: 1,
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
  islandCount: 10,
  openingEdgeRatio: 0.6,
  countRoundCount: 1,
  connectivityRoundCount: 0,
  countReasoningUndecidedRatio: 0,
  readingRoundCount: 1,
  openingSaturatedIslandCount: 2,
  closureRoundCount: 0,
  groupClosureRoundCount: 0,
  passageRoundCount: 0,
  lookaheadRoundCount: 0,
  countLookaheadRoundCount: 0,
  groupLookaheadRoundCount: 0,
  chainedLookaheadRoundCount: 0,
  crossingBlockCount: 0,
  clueMean: 3,
  highClueCount: 2,
  veryHighClueCount: 1,
  dominantClueShare: 0.3,
  twoClueShare: 0.25,
  doubleBridgeRatio: 0.45,
  loopCount: 0,
  borderBridgeShare: 0.4,
  usedEdgeShare: 0.8,
  islandShare: 10 / 36,
  diagonalNeighborShare: 0.3,
  borderIslandShare: 0.6,
  shortBridgeShare: 0.4,
  longBridgeCount: 2,
  lookaheadSpotCount: 0,
  longestLookaheadChain: 0,
  lastConnectivityDecidedRatio: 0,
};

const level2: BridgesAssessedFeatures = {
  ...level1,
  boardSize: 7,
  islandCount: 13,
  islandShare: 13 / 49,
  openingEdgeRatio: 0.4,
  countRoundCount: 1,
  connectivityRoundCount: 1,
  closureRoundCount: 1,
  readingRoundCount: 2,
  loopCount: 1,
};

const level3: BridgesAssessedFeatures = {
  ...level2,
  boardSize: 8,
  islandCount: 17,
  islandShare: 17 / 64,
  connectivityRoundCount: 2,
  readingRoundCount: 3,
  countReasoningUndecidedRatio: 0.5,
  closureRoundCount: 2,
  groupClosureRoundCount: 1,
  crossingBlockCount: 1,
  clueMean: 3.1,
  borderIslandShare: 0.4,
};

const level4: BridgesAssessedFeatures = {
  ...level3,
  boardSize: 10,
  islandCount: 22,
  islandShare: 0.22,
  countRoundCount: 2,
  connectivityRoundCount: 3,
  readingRoundCount: 5,
  lookaheadRoundCount: 1,
  countLookaheadRoundCount: 1,
  groupLookaheadRoundCount: 1,
  highClueCount: 2,
  loopCount: 2,
  lookaheadSpotCount: 1,
  longestLookaheadChain: 1,
  lastConnectivityDecidedRatio: 0.6,
};

const level5: BridgesAssessedFeatures = {
  ...level4,
  islandCount: 25,
  islandShare: 0.25,
  countRoundCount: 2,
  connectivityRoundCount: 4,
  readingRoundCount: 6,
  lookaheadRoundCount: 2,
  lookaheadSpotCount: 2,
  crossingBlockCount: 2,
  highClueCount: 3,
  longBridgeCount: 3,
};

describe("assessBridgesDifficulty", () => {
  test.each([
    ["決め打ちの後、少なくとも1本の読みが1回だけ要る 6×6", level1, "1"],
    ["少なくとも1本の読みと、2島を閉じない読みが1回要る 7×7", level2, "2"],
    ["閉じない読みが2回要り、交差で行き先が塞がる 8×8", level3, "3"],
    ["1手の先読みが1か所で1つ要る島22の 10×10", level4, "4"],
    ["1手の先読みが2か所で要る島25の 10×10", level5, "5"],
    [
      "1手の先読みが2か所で要り、1か所で続けて2つ要る島25の 10×10",
      {
        ...level5,
        lookaheadRoundCount: 3,
        chainedLookaheadRoundCount: 1,
        longestLookaheadChain: 2,
      },
      "5",
    ],
  ] as const)("%sをレベル %s にすること", (_, features, expected) => {
    const assessment = assessBridgesDifficulty(createAnalysis(features));

    expect(assessment).toMatchObject({
      status: "classified",
      difficulty: expected,
    });
  });

  test.each([
    ["入口が全部の 6×6", { ...level1, openingEdgeRatio: 1 }],
    ["島が8つの 6×6", { ...level1, islandCount: 8, islandShare: 8 / 36 }],
    ["決め打ちの無い 6×6", { ...level1, openingSaturatedIslandCount: 0 }],
    [
      "少なくとも1本の読みが2回要る 6×6",
      { ...level1, countRoundCount: 2, readingRoundCount: 2 },
    ],
    ["数字の平均が 2.7 の 6×6", { ...level1, clueMean: 2.7 }],
    ["45%の島が同じ数字の 6×6", { ...level1, dominantClueShare: 0.45 }],
    ["数字2の島が4割の 6×6", { ...level1, twoClueShare: 0.4 }],
    ["2本の組が2割の 6×6", { ...level1, doubleBridgeRatio: 0.2 }],
    ["外周に沿う橋が5割の 6×6", { ...level1, borderBridgeShare: 0.5 }],
    ["交差で塞がる行き先が3つの 6×6", { ...level1, crossingBlockCount: 3 }],
    [
      "斜め隣に島のある島が6割の 6×6",
      { ...level1, diagonalNeighborShare: 0.6 },
    ],
    ["間が1マスの橋が65%の 6×6", { ...level1, shortBridgeShare: 0.65 }],
    ["長い橋の無い 6×6", { ...level1, longBridgeCount: 0 }],
    ["行き先の9割に橋を架ける 6×6", { ...level1, usedEdgeShare: 0.9 }],
    [
      "少なくとも1本の読みが要らない 8×8",
      { ...level2, boardSize: 8, countRoundCount: 0, readingRoundCount: 1 },
    ],
    ["解に輪の無い 7×7", { ...level2, loopCount: 0 }],
    [
      "2島を閉じない読みの無い 7×7",
      { ...level2, connectivityRoundCount: 0, closureRoundCount: 0 },
    ],
    [
      "3島以上の組を閉じない読みが要る 7×7",
      { ...level2, groupClosureRoundCount: 1 },
    ],
    [
      "つながりの読みが、多くの組をまとめて決める手詰まりだけの 8×8",
      { ...level3, closureRoundCount: 0 },
    ],
    ["交差で塞がる行き先の無い 8×8", { ...level3, crossingBlockCount: 0 }],
    ["数字の平均が 2.9 の 8×8", { ...level3, clueMean: 2.9 }],
    ["外周の島が55%の 8×8", { ...level3, borderIslandShare: 0.55 }],
    ["間が1マスの橋が55%の 8×8", { ...level3, shortBridgeShare: 0.55 }],
    ["1手の先読みが要る 8×8", { ...level3, lookaheadRoundCount: 1 }],
    ["5以上の数字の島が1つの 10×10", { ...level4, highClueCount: 1 }],
    ["読みが4回の 10×10", { ...level4, readingRoundCount: 4 }],
    [
      "最後のつながりの読みが解き進みの4割の所にある 10×10",
      { ...level4, lastConnectivityDecidedRatio: 0.4 },
    ],
    [
      "1手の先読みが1か所で続けて2つ要る 10×10",
      {
        ...level4,
        lookaheadRoundCount: 2,
        chainedLookaheadRoundCount: 1,
        longestLookaheadChain: 2,
      },
    ],
    ["6以上の数字の島が無い島25の 10×10", { ...level5, veryHighClueCount: 0 }],
    [
      "閉じない読みの気づきが無い島25の 10×10",
      { ...level5, closureRoundCount: 0 },
    ],
    ["長い橋が1本だけの島25の 10×10", { ...level5, longBridgeCount: 1 }],
    [
      "1手の先読みが2か所で要るが、島が22の 10×10",
      { ...level5, islandCount: 22, islandShare: 0.22 },
    ],
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
    veryHighClueCount: 1,
    maximumClue: 6,
    dominantClueShare: 0.3,
    twoClueShare: 0.25,
    doubleBridgeRatio: 0.45,
    loopCount: 1,
    borderBridgeShare: 0.4,
    longBridgeShare: 0.2,
    usedEdgeShare: 0.8,
    islandShare: 0.2,
    diagonalNeighborShare: 0.3,
    shortBridgeShare: 0.4,
    longBridgeCount: 2,
    pointSymmetric: 0,
    borderIslandShare: 0.4,
    gridAlignmentShare: 0.3,
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

  test("レベル4 と 5 の島の数の範囲が重ならないこと", () => {
    expect(bridgesLevelCombinations["4"].islandCount.maximum).toBeLessThan(
      bridgesLevelCombinations["5"].islandCount.minimum,
    );
  });
});

describe("bridgesLevelReadings", () => {
  const pairs = difficultyLevels
    .slice(1)
    .map(({ id }, index) => [
      bridgesLevelReadings[difficultyLevels[index]!.id],
      bridgesLevelReadings[id],
    ]);

  test("上のレベルほど、1手の先読み・組を見る先読み・交差・大きい数字の下限を下げないこと", () => {
    const lowered = pairs.flatMap(([lower, upper]) =>
      (
        [
          "lookaheadRoundCount",
          "groupLookaheadRoundCount",
          "chainedLookaheadRoundCount",
          "crossingBlockCount",
          "highClueCount",
          "veryHighClueCount",
        ] as const
      ).filter((key) => upper![key].minimum < lower![key].minimum),
    );

    expect(lowered).toEqual([]);
  });

  test("レベル3 は先読みを求めず、レベル4 は1か所で1つ、レベル5 は2か所以上で求め、レベル4 と 5 が重ならないこと", () => {
    const places = (["3", "4", "5"] as const).map((id) => [
      bridgesLevelStructures[id].lookaheadSpotCount.minimum,
      bridgesLevelStructures[id].lookaheadSpotCount.maximum,
      bridgesLevelStructures[id].longestLookaheadChain.maximum,
    ]);

    expect(places).toEqual([
      [0, 0, 0],
      [1, 1, 1],
      [2, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    ]);
  });

  test("レベル1 と 2 には、解き始めの決め打ちを必ず求めること", () => {
    const minimums = (["1", "2"] as const).map(
      (id) => bridgesLevelReadings[id].openingSaturatedIslandCount.minimum,
    );

    expect(minimums).toEqual([1, 1]);
  });

  test("レベル1 は、ちょうど以外の読みを1回までにすること", () => {
    expect(bridgesLevelReadings["1"].readingRoundCount.maximum).toBe(1);
  });
});

describe("listBridgesGenerationConditions", () => {
  test("レベルの盤面の範囲の大きさだけを挙げること", () => {
    const sizes = difficultyLevels.map(({ id }) => [
      ...new Set(listBridgesGenerationConditions(id).map(({ size }) => size)),
    ]);

    expect(sizes).toEqual([[6, 7], [7, 8], [8, 9], [9, 10], [10]]);
  });

  test("2本の割合・輪の割合・分割の全ての組を、島の数がレベルの範囲に入る割合と、点対称の配置で挙げること", () => {
    const conditions = listBridgesGenerationConditions("5");
    const densities = [
      ...new Set(conditions.map(({ islandDensity }) => islandDensity)),
    ];
    const symmetries = [
      ...new Set(conditions.map(({ layoutSymmetry }) => layoutSymmetry)),
    ];

    expect(conditions).toHaveLength(48);
    expect(densities).toEqual([0.24, 0.25, 0.26]);
    expect(symmetries).toEqual(["none", "point"]);
  });

  test("レベル1・2 は点対称の配置の条件を挙げないこと", () => {
    const symmetries = (["1", "2"] as const).map((id) => [
      ...new Set(
        listBridgesGenerationConditions(id).map(
          ({ layoutSymmetry }) => layoutSymmetry,
        ),
      ),
    ]);

    expect(symmetries).toEqual([["none"], ["none"]]);
  });
});
