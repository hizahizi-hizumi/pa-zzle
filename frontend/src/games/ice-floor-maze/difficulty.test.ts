import {
  assessIceFloorMazeDifficulty,
  isIceFloorMazeBoardShapeOfDifficulty,
} from "@/games/ice-floor-maze/difficulty";
import type {
  IceFloorMazeDifficultyAnalysis,
  IceFloorMazeElementComposition,
  IceFloorMazeElementFeatures,
  IceFloorMazeTacticFeatures,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import type { IceFloorMazeBoardShape } from "@/games/ice-floor-maze/problem/problem";

const shape8x8 = { width: 8, height: 8 };
const shape10x10 = { width: 10, height: 10 };
const shape9x11 = { width: 9, height: 11 };

const baseTactics: IceFloorMazeTacticFeatures = {
  optimalMoveCount: 8,
  optimalSolutionCount: 1,
  forcedMoveCount: 0,
  reachableStopCount: 30,
  deadStopCount: 0,
  tags: ["stopper", "detour"],
  readingDepth: 2,
  nearPathCount: 10,
  passLureCount: 0,
  trapLureCount: 0,
  silentTrapLureCount: 0,
  reentryCount: 0,
  detourCount: 1,
  funnelDepth: 1,
  forkCount: 1,
};

const baseElements: IceFloorMazeElementFeatures = {
  optimalMoveCount: 14,
  optimalSolutionCount: 1,
  forcedMoveCount: 1,
  reachableStateCount: 500,
  deadStateCount: 300,
  elementCount: 4,
  brittleRockCount: 0,
  thinIceCount: 4,
  usedElementCount: 3,
  decoyCount: 1,
  weakDecoyCount: 0,
  irrelevantElementCount: 0,
  useCount: 4,
  orderDependencyCount: 3,
  orderChain: 3,
  orderTrapCount: 2,
  lureCount: 3,
  solutionRepeatCount: 0,
  nearRepeatCount: 0,
  brittleChainCount: 0,
  looksReading: "unsolvable",
  staticShortcut: false,
  stateReadingDepth: 6,
  hardness: 40,
};

function tactics(
  shape: IceFloorMazeBoardShape,
  features: Partial<IceFloorMazeTacticFeatures>,
): IceFloorMazeDifficultyAnalysis {
  return {
    status: "analyzed",
    shape,
    composition: "none",
    features: { ...baseTactics, ...features },
  };
}

function elements(
  shape: IceFloorMazeBoardShape,
  composition: Exclude<IceFloorMazeElementComposition, "none">,
  features: Partial<IceFloorMazeElementFeatures>,
): IceFloorMazeDifficultyAnalysis {
  return {
    status: "analyzed",
    shape,
    composition,
    features: { ...baseElements, ...features },
  };
}

describe("assessIceFloorMazeDifficulty", () => {
  const classifiedCases = [
    [
      "氷と岩だけ・止め石・読み2手・最短8手",
      tactics(shape8x8, {}),
      "1",
      "none",
    ],
    [
      "氷と岩だけ・止め石と回り込み・読み3手・最短11手",
      tactics(shape10x10, {
        optimalMoveCount: 11,
        tags: ["stopper", "wrap-around", "detour"],
        readingDepth: 3,
      }),
      "2",
      "none",
    ],
    [
      "氷と岩だけ・通過の誘いと入り直しと遠回り・読み4手・最短15手",
      tactics(shape10x10, {
        optimalMoveCount: 15,
        tags: ["pass-lure", "reentry", "detour", "fork"],
        readingDepth: 4,
        nearPathCount: 40,
      }),
      "2",
      "none",
    ],
    [
      "もろい岩だけ4個",
      elements(shape8x8, "brittle-rock", {
        brittleRockCount: 4,
        thinIceCount: 0,
      }),
      "3",
      "brittle-rock",
    ],
    ["薄い氷だけ4個", elements(shape10x10, "thin-ice", {}), "3", "thin-ice"],
    [
      "薄い氷だけ7個",
      elements(shape10x10, "thin-ice", {
        elementCount: 7,
        thinIceCount: 7,
        decoyCount: 2,
      }),
      "4",
      "thin-ice",
    ],
    [
      "もろい岩2個と薄い氷3個",
      elements(shape8x8, "mixed", {
        elementCount: 5,
        brittleRockCount: 2,
        thinIceCount: 3,
        decoyCount: 1,
      }),
      "4",
      "mixed",
    ],
    [
      "もろい岩3個と薄い氷5個・難しさ50",
      elements(shape9x11, "mixed", {
        optimalMoveCount: 18,
        elementCount: 8,
        brittleRockCount: 3,
        thinIceCount: 5,
        decoyCount: 2,
        hardness: 50,
      }),
      "5",
      "mixed",
    ],
  ] as const;

  test.each(classifiedCases)(
    "要素・手筋・手数の組をレベルへ分類すること: %s",
    (_, analysis, difficulty, composition) => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toEqual({
        status: "classified",
        difficulty,
        composition,
      });
    },
  );

  const unlistedCases = [
    [
      "氷と岩だけ・止め石だけ・最短12手",
      tactics(shape8x8, { optimalMoveCount: 12 }),
    ],
    [
      "氷と岩だけ・止め石と詰みの誘い",
      tactics(shape8x8, { tags: ["stopper", "trap-lure"] }),
    ],
    ["レベル1の手筋だが盤面がレベル1の形に収まらない", tactics(shape10x10, {})],
    [
      "もろい岩と薄い氷8個だが難しさが低い",
      elements(shape10x10, "mixed", {
        optimalMoveCount: 18,
        elementCount: 8,
        brittleRockCount: 3,
        thinIceCount: 5,
        decoyCount: 2,
        hardness: 30,
      }),
    ],
    [
      "もろい岩だけ7個",
      elements(shape8x8, "brittle-rock", {
        elementCount: 7,
        brittleRockCount: 7,
        thinIceCount: 0,
        decoyCount: 2,
      }),
    ],
  ] as const;

  test.each(unlistedCases)(
    "どのレベルの組にも当たらない問題を提供範囲外とすること: %s",
    (_, analysis) => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toMatchObject({
        status: "out-of-range",
        reason: "unlisted-combination",
      });
    },
  );

  const unmetCases = [
    [
      "最短解が2つ",
      tactics(shape8x8, { optimalSolutionCount: 2 }),
      ["multiple-solutions"],
    ],
    [
      "一本道が最短の4分の1を超える",
      tactics(shape8x8, { forcedMoveCount: 3 }),
      ["forced"],
    ],
    ["読めない", tactics(shape8x8, { readingDepth: null }), ["unreadable"]],
    [
      "同じ向きが続く手と、もろい岩の連鎖",
      elements(shape8x8, "mixed", {
        brittleRockCount: 2,
        thinIceCount: 2,
        nearRepeatCount: 1,
        brittleChainCount: 1,
      }),
      ["repeated-direction", "brittle-chain"],
    ],
    [
      "効かない要素があり、おとりが無い",
      elements(shape8x8, "thin-ice", {
        irrelevantElementCount: 1,
        decoyCount: 0,
      }),
      ["irrelevant-element", "few-decoys"],
    ],
    [
      "要素7個でおとりが1個",
      elements(shape8x8, "thin-ice", { elementCount: 7, decoyCount: 1 }),
      ["few-decoys"],
    ],
    [
      "使う回数が2回で、見た目どおりで解ける",
      elements(shape8x8, "thin-ice", { useCount: 2, staticShortcut: true }),
      ["few-uses", "static-shortcut"],
    ],
    [
      "両方の盤面でもろい岩が1個",
      elements(shape8x8, "mixed", { brittleRockCount: 1, thinIceCount: 3 }),
      ["element-mix"],
    ],
  ] as const;

  test.each(unmetCases)(
    "採用条件を満たさない問題を、満たさない条件とともに提供範囲外とすること: %s",
    (_, analysis, unmetConditions) => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toEqual({
        status: "out-of-range",
        reason: "unmet-conditions",
        unmetConditions,
      });
    },
  );

  describe("状態の数が上限を超える場合", () => {
    const analysis: IceFloorMazeDifficultyAnalysis = {
      status: "unsupported",
      reason: "state-limit-exceeded",
      shape: shape10x10,
    };

    test("評価不能とすること", () => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toEqual({
        status: "unsupported",
        reason: "state-limit-exceeded",
      });
    });
  });

  describe("ゴールへ止まれない場合", () => {
    const analysis: IceFloorMazeDifficultyAnalysis = {
      status: "invalid",
      reason: "goal-unreachable",
      shape: shape8x8,
    };

    test("成立しない問題とすること", () => {
      const assessment = assessIceFloorMazeDifficulty(analysis);

      expect(assessment).toEqual({
        status: "invalid",
        reason: "goal-unreachable",
      });
    });
  });
});

describe("isIceFloorMazeBoardShapeOfDifficulty", () => {
  const cases = [
    [shape8x8, "1", true],
    [{ width: 7, height: 8 }, "1", true],
    [{ width: 8, height: 9 }, "1", false],
    [shape10x10, "2", true],
    [shape9x11, "4", false],
    [shape9x11, "5", true],
    [{ width: 10, height: 12 }, "5", true],
    [{ width: 11, height: 12 }, "5", false],
    [{ width: 9, height: 8 }, "5", false],
  ] as const;

  test.each(cases)(
    "盤面の形がレベルで出す最も広い形に収まる縦長かを返すこと: %o レベル %s",
    (shape, difficulty, expected) => {
      const result = isIceFloorMazeBoardShapeOfDifficulty(shape, difficulty);

      expect(result).toBe(expected);
    },
  );
});
