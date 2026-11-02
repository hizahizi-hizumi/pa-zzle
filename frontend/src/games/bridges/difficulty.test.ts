import {
  assessBridgesDifficulty,
  bridgesLevelCombinations,
  listBridgesGenerationConditions,
} from "@/games/bridges/difficulty";
import type { BridgesDifficultyAnalysis } from "@/games/bridges/problem/difficulty-analysis";
import { difficultyLevels } from "@/games/difficulty";

type Features = {
  size: number;
  countRoundCount: number;
  connectivityRoundCount: number;
  undecidedRatio: number;
  backtrackCount: number;
};

function createAnalysis({
  size,
  countRoundCount,
  connectivityRoundCount,
  undecidedRatio,
  backtrackCount,
}: Features): BridgesDifficultyAnalysis {
  return {
    status: "analyzed",
    requiresTrial: false,
    scale: { size, islandCount: 20, edgeCount: 30, bridgeCount: 25 },
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
      openingEdgeRatio: 0.3,
    },
    trial: {
      medianBacktrackCount: backtrackCount,
      medianDisconnectedFullCount: 0,
      firstTrySolvedRatio: 0,
    },
  };
}

const base = {
  countRoundCount: 0,
  connectivityRoundCount: 0,
  undecidedRatio: 0,
  backtrackCount: 0,
};

describe("assessBridgesDifficulty", () => {
  test.each([
    ["数字のちょうどの読みだけで決まる 6×6", { ...base, size: 6 }, "1"],
    [
      "少なくとも1本の読みが要る 7×7",
      { ...base, size: 7, countRoundCount: 1 },
      "2",
    ],
    [
      "つながりを1回読み、数字で半分まで決まる 8×8",
      {
        ...base,
        size: 8,
        countRoundCount: 1,
        connectivityRoundCount: 1,
        undecidedRatio: 0.5,
      },
      "3",
    ],
    [
      "つながりを1回読み、数字で半分も決まらず試し置きで1回戻す 9×9",
      {
        ...base,
        size: 9,
        connectivityRoundCount: 1,
        undecidedRatio: 0.55,
        backtrackCount: 1,
      },
      "4",
    ],
    [
      "レベル4 と 5 の両方に当たる 10×10",
      {
        ...base,
        size: 10,
        connectivityRoundCount: 2,
        undecidedRatio: 0.7,
        backtrackCount: 3,
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
    ["数字だけで決まる 10×10", { ...base, size: 10, countRoundCount: 2 }],
    ["少なくとも1本の読みが要る 6×6", { ...base, size: 6, countRoundCount: 1 }],
    [
      "数字で6割より多く決まらず試し置きで2回しか戻さない 10×10 の、つながり1回の問題で、数字で半分決まるもの",
      {
        ...base,
        size: 10,
        connectivityRoundCount: 1,
        undecidedRatio: 0.5,
        backtrackCount: 2,
      },
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
  const systems = [
    "boardSize",
    "connectivityRoundCount",
    "countReasoningUndecidedRatio",
    "trialBacktrackCount",
  ] as const;

  test("上のレベルほど、盤面・つながり・数字で決まらない割合・試し置きの戻しの下限を下げないこと", () => {
    const lowered = pairs.flatMap(([lower, upper]) =>
      systems.filter((key) => upper![key].minimum < lower![key].minimum),
    );

    expect(lowered).toEqual([]);
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

  test("密度・2本の割合・輪の割合の全ての組を挙げること", () => {
    const count = listBridgesGenerationConditions("5").length;

    expect(count).toBe(12);
  });
});
