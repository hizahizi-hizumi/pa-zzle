import {
  assessBridgesDifficulty,
  bridgesLevelCombinations,
  listBridgesGenerationConditions,
} from "@/games/bridges/difficulty";
import type { BridgesDifficultyAnalysis } from "@/games/bridges/problem/difficulty-analysis";
import { difficultyLevels } from "@/games/difficulty";

type Features = {
  size: number;
  islandCount: number;
  openingEdgeRatio: number;
  countRoundCount: number;
  connectivityRoundCount: number;
  undecidedRatio: number;
};

function createAnalysis({
  size,
  islandCount,
  openingEdgeRatio,
  countRoundCount,
  connectivityRoundCount,
  undecidedRatio,
}: Features): BridgesDifficultyAnalysis {
  return {
    status: "analyzed",
    requiresTrial: false,
    scale: { size, islandCount, edgeCount: 30, bridgeCount: 25 },
    reasoning: {
      maximumTier:
        connectivityRoundCount > 0 ? "C1p" : countRoundCount > 0 ? "A2" : "A1",
      countRoundCount,
      connectivityRoundCount,
      roundCountByTier: {
        A1: 1,
        A2: countRoundCount,
        C1p: connectivityRoundCount,
        C1g: 0,
        C3: 0,
        D: 0,
        T: 0,
      },
      countReasoningUndecidedRatio: undecidedRatio,
      openingEdgeRatio,
    },
    trial: {
      medianBacktrackCount: 0,
      medianDisconnectedFullCount: 0,
      firstTrySolvedRatio: 1,
    },
  };
}

const level1: Features = {
  size: 6,
  islandCount: 9,
  openingEdgeRatio: 0.6,
  countRoundCount: 0,
  connectivityRoundCount: 0,
  undecidedRatio: 0,
};
const level4: Features = {
  size: 10,
  islandCount: 22,
  openingEdgeRatio: 0.2,
  countRoundCount: 2,
  connectivityRoundCount: 2,
  undecidedRatio: 0.7,
};

describe("assessBridgesDifficulty", () => {
  test.each([
    ["入口が広く、数字のちょうどの読みだけで決まる 6×6", level1, "1"],
    [
      "入口が狭く、少なくとも1本の読みが2回要る 7×7",
      {
        ...level1,
        size: 7,
        islandCount: 12,
        openingEdgeRatio: 0.4,
        countRoundCount: 2,
      },
      "2",
    ],
    [
      "つながりを1か所読み、数字で半分まで決まる 8×8",
      {
        ...level4,
        size: 8,
        islandCount: 16,
        connectivityRoundCount: 1,
        undecidedRatio: 0.5,
      },
      "3",
    ],
    ["つながりを2か所読む 10×10", level4, "4"],
    [
      "つながりを3か所読む 10×10",
      { ...level4, connectivityRoundCount: 3 },
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
    ["島が6つの 6×6", { ...level1, islandCount: 6 }],
    [
      "入口が狭く、少なくとも1本の読みが1回だけの 7×7",
      {
        ...level1,
        size: 7,
        islandCount: 12,
        openingEdgeRatio: 0.4,
        countRoundCount: 1,
      },
    ],
    [
      "入口の広い、少なくとも1本の読みが要る 8×8",
      {
        ...level1,
        size: 8,
        islandCount: 15,
        openingEdgeRatio: 0.5,
        countRoundCount: 1,
      },
    ],
    [
      "数字だけでは6割しか決まらない、つながり3か所の 10×10",
      { ...level4, connectivityRoundCount: 3, undecidedRatio: 0.6 },
    ],
    [
      "つながりを5か所読む 9×9",
      { ...level4, size: 9, connectivityRoundCount: 5 },
    ],
  ] as const)("%sを組み合わせ外にすること", (_, features) => {
    const assessment = assessBridgesDifficulty(createAnalysis(features));

    expect(assessment).toMatchObject({
      status: "out-of-range",
      reason: "unlisted-combination",
    });
  });

  test.each([
    [
      "試し置きが要る",
      {
        status: "analyzed",
        requiresTrial: true,
        scale: { size: 10, islandCount: 20, edgeCount: 30, bridgeCount: 25 },
      },
      { status: "out-of-range", reason: "requires-trial" },
    ],
    [
      "試し置きでも決まらない",
      {
        status: "unsupported",
        scale: { size: 10, islandCount: 20, edgeCount: 30, bridgeCount: 25 },
      },
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

  // 「少なくとも」の手詰まり回数は、つながりを読まない レベル1・2 を分けるだけに使う。レベル3 からはつながりの読み（上の段）が要る。
  const raisingSystems = [
    "boardSize",
    "islandCount",
    "connectivityRoundCount",
    "countReasoningUndecidedRatio",
  ] as const;

  test("上のレベルほど、盤面・島の数・つながり・数字で決まらない割合の下限を下げないこと", () => {
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
});

describe("listBridgesGenerationConditions", () => {
  test("レベルの盤面の範囲の大きさだけを挙げること", () => {
    const sizes = difficultyLevels.map(({ id }) => [
      ...new Set(listBridgesGenerationConditions(id).map(({ size }) => size)),
    ]);

    expect(sizes).toEqual([[6, 7], [7, 8], [8, 9], [9, 10], [10]]);
  });

  test("密度・2本の割合・輪の割合・分割の全ての組を挙げること", () => {
    const count = listBridgesGenerationConditions("5").length;

    expect(count).toBe(24);
  });
});
