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
  shortSlideCount: 1,
  averageSlideLength: 3,
  longestChoicelessStair: 2,
  floors: {
    floorCount: 0,
    usedFloorCount: 0,
    floorStopCount: 0,
    decoyFloorCount: 0,
    irrelevantFloorCount: 0,
    repeatCount: 0,
    nearRepeatCount: 0,
    tapCount: 0,
    splitReadingDepth: 2,
  },
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
  looksShortest: null,
  looksPassingMoveCount: null,
  lingeringDecoyCount: 0,
  rockShare: 0.2,
  selfMadeDependence: 3.5,
  texture: {
    shortSlideCount: 2,
    averageSlideLength: 3,
    longestStair: 3,
    longestChoicelessStair: 2,
    longestIdleRun: 2,
    selfMadeUseCount: 3,
    selfMadeMaximumGap: 4,
    selfMadeTotalGap: 7,
    quickReturnCount: 1,
    variedUseCount: 2,
    distantStopCount: 1,
    goalStopsOnSelfMade: false,
    changedCellCount: 4,
    maximumChangedPerMove: 2,
    maximumChangeSpread: 1,
    changedAreaSpan: 6,
  },
  stateReadingDepth: 6,
  hardness: 40,
  floorCount: 0,
};

/** 床の無い盤面の、床で区切った読み深さは元の読み深さと同じ。 */
function tactics(
  shape: IceFloorMazeBoardShape,
  features: Partial<IceFloorMazeTacticFeatures>,
): IceFloorMazeDifficultyAnalysis {
  const readingDepth =
    features.readingDepth === undefined
      ? baseTactics.readingDepth
      : features.readingDepth;
  return {
    status: "analyzed",
    shape,
    composition: "none",
    features: {
      ...baseTactics,
      ...features,
      floors: features.floors ?? {
        ...baseTactics.floors,
        splitReadingDepth: readingDepth,
      },
    },
  };
}

/** 床で止まる手とおとりの床が1つずつある、採用条件を満たす床の働き。 */
const usefulFloors: IceFloorMazeTacticFeatures["floors"] = {
  floorCount: 2,
  usedFloorCount: 1,
  floorStopCount: 1,
  decoyFloorCount: 1,
  irrelevantFloorCount: 0,
  repeatCount: 0,
  nearRepeatCount: 1,
  tapCount: 0,
  splitReadingDepth: 2,
};

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
      "氷と岩と床2マス（止まる床とおとりの床）・止め石・読み2手・最短8手",
      tactics(shape8x8, { floors: usefulFloors }),
      "1",
      "none",
    ],
    [
      "氷と岩と床・止め石と回り込み・読み3手・最短11手・床で区切っても読み3手",
      tactics(shape10x10, {
        optimalMoveCount: 11,
        tags: ["stopper", "wrap-around", "detour"],
        readingDepth: 3,
        floors: { ...usefulFloors, splitReadingDepth: 3 },
      }),
      "2",
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
      "もろい岩だけ3個・変化させるのは2個・自作依存の点2",
      elements(shape8x8, "brittle-rock", {
        optimalMoveCount: 12,
        elementCount: 3,
        brittleRockCount: 3,
        thinIceCount: 0,
        usedElementCount: 2,
        selfMadeDependence: 2,
      }),
      "3",
      "brittle-rock",
    ],
    [
      "薄い氷だけ2個・自作依存の点3",
      elements(shape10x10, "thin-ice", {
        optimalMoveCount: 11,
        elementCount: 2,
        thinIceCount: 2,
        usedElementCount: 1,
        selfMadeDependence: 3,
      }),
      "3",
      "thin-ice",
    ],
    [
      "薄い氷だけ4個・自作依存の点3.5",
      elements(shape10x10, "thin-ice", {}),
      "4",
      "thin-ice",
    ],
    [
      "もろい岩2個と薄い氷3個・自作依存の点5.5",
      elements(shape8x8, "mixed", {
        elementCount: 5,
        brittleRockCount: 2,
        thinIceCount: 3,
        selfMadeDependence: 5.5,
      }),
      "4",
      "mixed",
    ],
    [
      "薄い氷だけ7個・自作依存の点6・2手以上前に作った水面で2回止まる",
      elements(shape9x11, "thin-ice", {
        optimalMoveCount: 18,
        elementCount: 7,
        thinIceCount: 7,
        decoyCount: 2,
        selfMadeDependence: 6,
        texture: { ...baseElements.texture, distantStopCount: 2 },
      }),
      "5",
      "thin-ice",
    ],
    [
      "もろい岩3個と薄い氷5個・自作依存の点8・2手以上前に作った水面で3回止まる",
      elements(shape9x11, "mixed", {
        optimalMoveCount: 18,
        elementCount: 8,
        brittleRockCount: 3,
        thinIceCount: 5,
        decoyCount: 2,
        selfMadeDependence: 8,
        texture: { ...baseElements.texture, distantStopCount: 3 },
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
      "止め石と回り込み・読み3手・最短11手だが、床で区切ると読み1手",
      tactics(shape10x10, {
        optimalMoveCount: 11,
        tags: ["stopper", "wrap-around", "detour"],
        readingDepth: 3,
        floors: { ...usefulFloors, splitReadingDepth: 1 },
      }),
    ],
    [
      "止め石・読み2手・最短8手だが、床が5マス",
      tactics(shape8x8, { floors: { ...usefulFloors, floorCount: 5 } }),
    ],
    [
      "薄い氷だけ2個・自作依存の点3だが、床がある",
      elements(shape8x8, "thin-ice", {
        elementCount: 2,
        usedElementCount: 2,
        decoyCount: 1,
        selfMadeDependence: 3,
        floorCount: 1,
      }),
    ],
    [
      "もろい岩と薄い氷8個・自作依存の点6だが、2手以上前に作った水面で1回しか止まらない",
      elements(shape10x10, "mixed", {
        optimalMoveCount: 18,
        elementCount: 8,
        brittleRockCount: 3,
        thinIceCount: 5,
        decoyCount: 2,
        selfMadeDependence: 6,
      }),
    ],
    [
      "薄い氷だけ3個だが自作依存の点が4",
      elements(shape8x8, "thin-ice", {
        elementCount: 3,
        thinIceCount: 3,
        usedElementCount: 2,
        selfMadeDependence: 4,
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
      "使う回数が1回で、見た目どおりで解ける",
      elements(shape8x8, "thin-ice", { useCount: 1, staticShortcut: true }),
      ["few-uses", "static-shortcut"],
    ],
    [
      "1マスだけの滑りが最短8手の4分の1を超える",
      tactics(shape8x8, { shortSlideCount: 3 }),
      ["short-slides"],
    ],
    [
      "選択肢の無い階段が3手",
      tactics(shape8x8, { longestChoicelessStair: 3 }),
      ["choiceless-stair"],
    ],
    [
      "最短解が床で止まった後に同じ向きへ続ける",
      tactics(shape8x8, { floors: { ...usefulFloors, repeatCount: 1 } }),
      ["repeated-direction"],
    ],
    [
      "床で止まった後に同じ向きへ1マスだけ進む手がどこかにある",
      tactics(shape8x8, { floors: { ...usefulFloors, tapCount: 1 } }),
      ["repeated-direction"],
    ],
    [
      "氷にしても何も変わらない床がある",
      tactics(shape8x8, {
        floors: { ...usefulFloors, floorCount: 3, irrelevantFloorCount: 1 },
      }),
      ["irrelevant-floor"],
    ],
    [
      "床が最短解で止まる床だけで、おとりの床が無い",
      tactics(shape8x8, {
        floors: { ...usefulFloors, floorCount: 1, decoyFloorCount: 0 },
      }),
      ["floor-landmark"],
    ],
    [
      "床がおとりだけで、最短解は床で止まらない",
      tactics(shape8x8, {
        floors: {
          ...usefulFloors,
          usedFloorCount: 0,
          floorStopCount: 0,
          decoyFloorCount: 2,
        },
      }),
      ["floor-landmark"],
    ],
    [
      "割ってすぐ戻る手筋が3回で、読みどころの無い手が5手続く",
      elements(shape8x8, "thin-ice", {
        texture: {
          ...baseElements.texture,
          quickReturnCount: 3,
          longestIdleRun: 5,
        },
      }),
      ["repeated-tactic", "idle-run"],
    ],
    [
      "自分で作った地形を割ってすぐ戻る手筋でしか使わない",
      elements(shape8x8, "thin-ice", {
        texture: {
          ...baseElements.texture,
          variedUseCount: 0,
          distantStopCount: 0,
        },
      }),
      ["repeated-tactic"],
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
