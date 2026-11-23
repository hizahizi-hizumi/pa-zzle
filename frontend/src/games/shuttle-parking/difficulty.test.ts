import {
  assessShuttleParkingDifficulty,
  getShuttleParkingWeightLevel,
} from "@/games/shuttle-parking/difficulty";
import type { ShuttleParkingDifficultyFeatures } from "@/games/shuttle-parking/problem/difficulty-analysis";
import { SHUTTLE_PARKING_NAIVE_RULES } from "@/games/shuttle-parking/problem/generation/naive-rules";

const noDecisions = { minimum: [0, 0, 0, 0], maximum: [0, 0, 0, 0], states: 1 };

function createFeatures(
  weight: number,
  overrides: Partial<ShuttleParkingDifficultyFeatures> = {},
): ShuttleParkingDifficultyFeatures {
  const bounds = { minimum: weight, maximum: weight };
  return {
    bayCount: 3,
    headFirst: { best: bounds, continuation: bounds },
    window: bounds,
    freePathMinimumWeight: weight,
    rules: Object.fromEntries(
      Object.keys(SHUTTLE_PARKING_NAIVE_RULES).map((rule) => [rule, 0.5]),
    ) as ShuttleParkingDifficultyFeatures["rules"],
    bestRules: Object.fromEntries(
      Object.keys(SHUTTLE_PARKING_NAIVE_RULES).map((rule) => [rule, 0.5]),
    ) as ShuttleParkingDifficultyFeatures["bestRules"],
    decisions: {
      best: noDecisions,
      continuation: noDecisions,
      window: noDecisions,
    },
    ...overrides,
  };
}

function assess(features: ShuttleParkingDifficultyFeatures) {
  return assessShuttleParkingDifficulty({ status: "analyzed", features });
}

describe("getShuttleParkingWeightLevel", () => {
  test.each([
    [0, "1"],
    [1, "2"],
    [4, "2"],
    [5, "3"],
    [7, "3"],
    [8, "4"],
    [9, "4"],
    [10, "5"],
    [30, "5"],
  ])("罠の重さ %i をレベル %s にすること", (weight, level) => {
    expect(getShuttleParkingWeightLevel(weight)).toBe(level);
  });
});

describe("assessShuttleParkingDifficulty", () => {
  test("どの勝ち筋でも同じ段の罠に出会う問題を、その段のレベルにすること", () => {
    const assessment = assess(createFeatures(8));

    expect(assessment).toEqual({ status: "classified", difficulty: "4" });
  });

  test("待機枠が範囲の外なら範囲外にすること", () => {
    const assessment = assess(createFeatures(8, { bayCount: 5 }));

    expect(assessment).toEqual({
      status: "out-of-range",
      reason: "bayCountOutOfRange",
    });
  });

  test("勝ち筋の選び方で段が変わるなら範囲外にすること", () => {
    const assessment = assess(
      createFeatures(8, {
        headFirst: {
          best: { minimum: 8, maximum: 10 },
          continuation: { minimum: 8, maximum: 8 },
        },
      }),
    );

    expect(assessment).toEqual({
      status: "out-of-range",
      reason: "pathDependent",
    });
  });

  test("罠の深さの取り方で段が変わるなら範囲外にすること", () => {
    const assessment = assess(
      createFeatures(8, {
        headFirst: {
          best: { minimum: 8, maximum: 8 },
          continuation: { minimum: 7, maximum: 7 },
        },
      }),
    );

    expect(assessment).toEqual({
      status: "out-of-range",
      reason: "depthDefinitionsDisagree",
    });
  });

  test("先回りする人で段が変わるなら範囲外にすること", () => {
    const assessment = assess(
      createFeatures(8, { window: { minimum: 5, maximum: 5 } }),
    );

    expect(assessment).toEqual({
      status: "out-of-range",
      reason: "playStylesDisagree",
    });
  });

  test("Lv1 で先回りする人だけが浅い罠に出会うのは許すこと", () => {
    const assessment = assess(
      createFeatures(0, { window: { minimum: 2, maximum: 2 } }),
    );

    expect(assessment).toEqual({ status: "classified", difficulty: "1" });
  });

  test("Lv3 以上で、候補の外の勝つ手から進めると重い罠を避けられるなら範囲外にすること", () => {
    const assessment = assess(createFeatures(10, { freePathMinimumWeight: 4 }));

    expect(assessment).toEqual({
      status: "out-of-range",
      reason: "freePathEscapes",
    });
  });

  test("Lv2 では、候補の外の勝つ手で罠を避けられても Lv2 のままにすること", () => {
    const assessment = assess(createFeatures(3, { freePathMinimumWeight: 0 }));

    expect(assessment).toEqual({ status: "classified", difficulty: "2" });
  });

  test("Lv3 以上で、素朴な規則のどれかが同点のどれかの選び方で 0.8 以上で勝つなら範囲外にすること", () => {
    const features = createFeatures(5);

    const assessment = assess({
      ...features,
      bestRules: { ...features.bestRules, deepCommit: 0.8 },
    });

    expect(assessment).toEqual({
      status: "out-of-range",
      reason: "naiveCeiling",
    });
  });

  test("同点を一様に選んだ勝率だけが 0.8 未満でも、選び方の最大で判定すること", () => {
    const features = createFeatures(8);

    const assessment = assess({
      ...features,
      rules: { ...features.rules, deepDig: 0.5 },
      bestRules: { ...features.bestRules, deepDig: 1 },
    });

    expect(assessment).toEqual({
      status: "out-of-range",
      reason: "naiveCeiling",
    });
  });

  test("Lv2 で、素朴な規則がどれも必ず負けるなら範囲外にすること", () => {
    const features = createFeatures(2);

    const assessment = assess({
      ...features,
      bestRules: Object.fromEntries(
        Object.keys(features.bestRules).map((rule) => [rule, 0]),
      ) as ShuttleParkingDifficultyFeatures["bestRules"],
    });

    expect(assessment).toEqual({
      status: "out-of-range",
      reason: "headPoliciesAllLose",
    });
  });

  test("待機枠が解ける最小の数でない問題は扱わないこと", () => {
    const assessment = assessShuttleParkingDifficulty({
      status: "unsupported",
      minimumBayCount: 2,
    });

    expect(assessment).toEqual({ status: "unsupported", minimumBayCount: 2 });
  });
});
