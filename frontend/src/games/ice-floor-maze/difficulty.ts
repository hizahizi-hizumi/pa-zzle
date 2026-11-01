import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NumericRange,
} from "@/games/difficulty";
import type {
  IceFloorMazeDifficultyAnalysis,
  IceFloorMazeElementComposition,
  IceFloorMazeElementFeatures,
  IceFloorMazeTacticFeatures,
  IceFloorMazeTacticTag,
} from "@/games/ice-floor-maze/problem/difficulty-analysis";
import {
  type IceFloorMazeBoardShape,
  isIceFloorMazeBoardShape,
} from "@/games/ice-floor-maze/problem/problem";

export type IceFloorMazeDifficulty = DifficultyLevel;

/**
 * 氷と岩だけのレベルの、挑戦の型（研究用の生成 v2 の手筋の組み合わせ）。
 * - `required` / `forbidden`: 含む手筋のタグ / 含まない手筋のタグ。
 * - `readingDepth`: 先読みのモデルで解ける読み手数の範囲。
 * - `nearPathCount`: 最少手数+2手以内の近い別解の数の範囲。どこからでも何となく着く問題を外す。
 */
export type IceFloorMazeTacticPattern = {
  optimalMoveCount: NumericRange;
  required: readonly IceFloorMazeTacticTag[];
  forbidden: readonly IceFloorMazeTacticTag[];
  readingDepth: NumericRange;
  nearPathCount: NumericRange;
};

/**
 * 要素のあるレベルの、挑戦の型（研究用の生成 v4 の要素の組み合わせ）。
 * - `composition` / `elementCount`: 置く要素の種類と数。
 * - `hardness`: 難しさの点（`IceFloorMazeElementFeatures` の `hardness`）の範囲。
 */
export type IceFloorMazeElementPattern = {
  composition: Exclude<IceFloorMazeElementComposition, "none">;
  optimalMoveCount: NumericRange;
  elementCount: NumericRange;
  hardness: NumericRange;
};

/**
 * 1つのレベルの基準。挑戦の型のどれか1つに当たればそのレベル。`largestBoardShape` は、そのレベルで出す盤面
 * （盤面の外を切り落とした外接の長方形）が収まる最も広い形。
 */
export type IceFloorMazeLevelCriteria =
  | {
      kind: "tactics";
      largestBoardShape: IceFloorMazeBoardShape;
      patterns: readonly IceFloorMazeTacticPattern[];
    }
  | {
      kind: "elements";
      largestBoardShape: IceFloorMazeBoardShape;
      patterns: readonly IceFloorMazeElementPattern[];
    };

const unbounded = Number.POSITIVE_INFINITY;
const anyHardness = { minimum: 0, maximum: unbounded } as const;

/**
 * 各レベルの基準。L1・L2 は氷と岩だけで手筋を足し、L3 はもろい岩か薄い氷の一方、L4 は薄い氷を多く、または両方を少し、
 * L5 は両方を多く置いて難しさの点が高いもの。手数と要素の数の範囲は試遊で決め直す前の仮の値。
 */
export const iceFloorMazeLevelCriteria = {
  "1": {
    kind: "tactics",
    largestBoardShape: { width: 8, height: 8 },
    patterns: [
      {
        optimalMoveCount: { minimum: 7, maximum: 10 },
        required: ["stopper"],
        forbidden: ["wrap-around", "pass-lure", "trap-lure", "backward-funnel"],
        readingDepth: { minimum: 1, maximum: 2 },
        nearPathCount: { minimum: 0, maximum: unbounded },
      },
    ],
  },
  "2": {
    kind: "tactics",
    largestBoardShape: { width: 10, height: 10 },
    patterns: [
      {
        optimalMoveCount: { minimum: 10, maximum: 13 },
        required: ["stopper", "wrap-around"],
        forbidden: ["trap-lure"],
        readingDepth: { minimum: 2, maximum: unbounded },
        nearPathCount: { minimum: 0, maximum: 30 },
      },
      {
        optimalMoveCount: { minimum: 12, maximum: 16 },
        required: ["pass-lure", "reentry", "detour"],
        forbidden: ["trap-lure"],
        readingDepth: { minimum: 3, maximum: unbounded },
        nearPathCount: { minimum: 0, maximum: 40 },
      },
    ],
  },
  "3": {
    kind: "elements",
    largestBoardShape: { width: 10, height: 10 },
    patterns: [
      {
        composition: "brittle-rock",
        optimalMoveCount: { minimum: 10, maximum: 16 },
        elementCount: { minimum: 3, maximum: 5 },
        hardness: anyHardness,
      },
      {
        composition: "thin-ice",
        optimalMoveCount: { minimum: 10, maximum: 16 },
        elementCount: { minimum: 3, maximum: 5 },
        hardness: anyHardness,
      },
    ],
  },
  "4": {
    kind: "elements",
    largestBoardShape: { width: 10, height: 10 },
    patterns: [
      {
        composition: "thin-ice",
        optimalMoveCount: { minimum: 12, maximum: 19 },
        elementCount: { minimum: 6, maximum: 7 },
        hardness: anyHardness,
      },
      {
        composition: "mixed",
        optimalMoveCount: { minimum: 12, maximum: 19 },
        elementCount: { minimum: 4, maximum: 6 },
        hardness: anyHardness,
      },
    ],
  },
  "5": {
    kind: "elements",
    largestBoardShape: { width: 10, height: 12 },
    patterns: [
      {
        composition: "mixed",
        optimalMoveCount: { minimum: 14, maximum: 22 },
        elementCount: { minimum: 7, maximum: 8 },
        hardness: { minimum: 45, maximum: unbounded },
      },
    ],
  },
} as const satisfies Record<IceFloorMazeDifficulty, IceFloorMazeLevelCriteria>;

/**
 * 全レベルに共通の採用条件。
 * - `forcedShare`: 一本道（戻らない選択肢が1つしかない手）を最少手数のこの割合まで。
 * - `minimumUses`: 最短解で要素を使う回数の下限。
 * - `decoyShare`: おとりを要素の数のこの割合（切り上げ、最低1）以上。
 * - `minimumEachInMixed`: 両方を置く盤面で、もろい岩・薄い氷それぞれの下限。
 */
export const iceFloorMazeCommonConditions = {
  forcedShare: 0.25,
  minimumUses: 3,
  decoyShare: 0.2,
  minimumEachInMixed: 2,
} as const;

/**
 * 採用条件のうち満たさないもの。
 * - `multiple-solutions`: 最短解が一意でない。
 * - `forced`: 一本道が多い。
 * - `unreadable`: 先読みのモデルが上限まで読んでも解けない（氷と岩だけ）。
 * - `repeated-direction` / `brittle-chain`: 同じ向きが続く手がある（条件1）。
 * - `irrelevant-element` / `few-decoys`: 効かない要素がある・おとりが足りない（条件2）。
 * - `few-uses`: 最短解で要素を使う回数が足りない。
 * - `static-shortcut`: 見た目どおりかもう一方の読みで短く解ける。
 * - `element-mix`: 両方を置く盤面で、一方が少ない。
 */
export type IceFloorMazeUnmetCondition =
  | "multiple-solutions"
  | "forced"
  | "unreadable"
  | "repeated-direction"
  | "brittle-chain"
  | "irrelevant-element"
  | "few-decoys"
  | "few-uses"
  | "static-shortcut"
  | "element-mix";

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 採用条件を満たし、いずれかのレベルの挑戦の型に当たった。
 * - `out-of-range`: 評価できるが提供しない。`unmet-conditions` は採用条件を満たさない。
 *   `unlisted-combination` は要素・手数・手筋・盤面の形の組がどのレベルにも当たらない。
 * - `unsupported`: 状態の数が上限を超え、評価できない。
 * - `invalid`: ゴールへ止まれず、問題として成立しない。
 */
export type IceFloorMazeDifficultyAssessment = DifficultyAssessment<{
  classified: { composition: IceFloorMazeElementComposition };
  outOfRange:
    | {
        reason: "unmet-conditions";
        unmetConditions: readonly IceFloorMazeUnmetCondition[];
      }
    | {
        reason: "unlisted-combination";
        composition: IceFloorMazeElementComposition;
        optimalMoveCount: number;
        shape: IceFloorMazeBoardShape;
      };
  unsupported: { reason: "state-limit-exceeded" };
  invalid: { reason: "goal-unreachable" };
}>;

function countNeededDecoys(elementCount: number): number {
  return Math.max(
    1,
    Math.ceil(iceFloorMazeCommonConditions.decoyShare * elementCount - 1e-9),
  );
}

function hasManyForcedMoves(features: {
  forcedMoveCount: number;
  optimalMoveCount: number;
}): boolean {
  return (
    features.forcedMoveCount >
    iceFloorMazeCommonConditions.forcedShare * features.optimalMoveCount
  );
}

export function listIceFloorMazeTacticUnmetConditions(
  features: IceFloorMazeTacticFeatures,
): IceFloorMazeUnmetCondition[] {
  return [
    ...(features.optimalSolutionCount > 1
      ? (["multiple-solutions"] as const)
      : []),
    ...(hasManyForcedMoves(features) ? (["forced"] as const) : []),
    ...(features.readingDepth === null ? (["unreadable"] as const) : []),
  ];
}

export function listIceFloorMazeElementUnmetConditions(
  composition: Exclude<IceFloorMazeElementComposition, "none">,
  features: IceFloorMazeElementFeatures,
): IceFloorMazeUnmetCondition[] {
  const conditions = iceFloorMazeCommonConditions;
  const checks = [
    ["multiple-solutions", features.optimalSolutionCount > 1],
    ["forced", hasManyForcedMoves(features)],
    [
      "repeated-direction",
      features.solutionRepeatCount > 0 || features.nearRepeatCount > 0,
    ],
    ["brittle-chain", features.brittleChainCount > 0],
    ["irrelevant-element", features.irrelevantElementCount > 0],
    [
      "few-decoys",
      features.decoyCount < countNeededDecoys(features.elementCount),
    ],
    ["few-uses", features.useCount < conditions.minimumUses],
    ["static-shortcut", features.staticShortcut],
    [
      "element-mix",
      composition === "mixed" &&
        Math.min(features.brittleRockCount, features.thinIceCount) <
          conditions.minimumEachInMixed,
    ],
  ] as const satisfies readonly (readonly [
    IceFloorMazeUnmetCondition,
    boolean,
  ])[];
  return checks.flatMap(([condition, unmet]) => (unmet ? [condition] : []));
}

/** 盤面の形が、そのレベルで出す最も広い形に収まるか。 */
export function isIceFloorMazeBoardShapeOfDifficulty(
  shape: IceFloorMazeBoardShape,
  difficulty: IceFloorMazeDifficulty,
): boolean {
  const largest = iceFloorMazeLevelCriteria[difficulty].largestBoardShape;
  return (
    isIceFloorMazeBoardShape(shape) &&
    shape.width <= largest.width &&
    shape.height <= largest.height
  );
}

function matchesTacticPattern(
  features: IceFloorMazeTacticFeatures,
  pattern: IceFloorMazeTacticPattern,
): boolean {
  return (
    isInNumericRange(features.optimalMoveCount, pattern.optimalMoveCount) &&
    pattern.required.every((tag) => features.tags.includes(tag)) &&
    !pattern.forbidden.some((tag) => features.tags.includes(tag)) &&
    isInNumericRange(
      features.readingDepth ?? unbounded,
      pattern.readingDepth,
    ) &&
    isInNumericRange(features.nearPathCount, pattern.nearPathCount)
  );
}

function matchesElementPattern(
  composition: IceFloorMazeElementComposition,
  features: IceFloorMazeElementFeatures,
  pattern: IceFloorMazeElementPattern,
): boolean {
  return (
    composition === pattern.composition &&
    isInNumericRange(features.optimalMoveCount, pattern.optimalMoveCount) &&
    isInNumericRange(features.elementCount, pattern.elementCount) &&
    isInNumericRange(features.hardness, pattern.hardness)
  );
}

function matchesLevel(
  analysis: Extract<IceFloorMazeDifficultyAnalysis, { status: "analyzed" }>,
  difficulty: IceFloorMazeDifficulty,
): boolean {
  const criteria: IceFloorMazeLevelCriteria =
    iceFloorMazeLevelCriteria[difficulty];
  if (!isIceFloorMazeBoardShapeOfDifficulty(analysis.shape, difficulty)) {
    return false;
  }
  if (analysis.composition === "none") {
    return (
      criteria.kind === "tactics" &&
      criteria.patterns.some((pattern) =>
        matchesTacticPattern(analysis.features, pattern),
      )
    );
  }
  return (
    criteria.kind === "elements" &&
    criteria.patterns.some((pattern) =>
      matchesElementPattern(analysis.composition, analysis.features, pattern),
    )
  );
}

export function assessIceFloorMazeDifficulty(
  analysis: IceFloorMazeDifficultyAnalysis,
): IceFloorMazeDifficultyAssessment {
  if (analysis.status === "invalid") {
    return { status: "invalid", reason: analysis.reason };
  }
  if (analysis.status === "unsupported") {
    return { status: "unsupported", reason: analysis.reason };
  }

  const unmetConditions =
    analysis.composition === "none"
      ? listIceFloorMazeTacticUnmetConditions(analysis.features)
      : listIceFloorMazeElementUnmetConditions(
          analysis.composition,
          analysis.features,
        );
  if (unmetConditions.length > 0) {
    return {
      status: "out-of-range",
      reason: "unmet-conditions",
      unmetConditions,
    };
  }

  const { composition, shape } = analysis;
  const difficulty = difficultyLevels.find(({ id }) =>
    matchesLevel(analysis, id),
  )?.id;
  return difficulty
    ? { status: "classified", difficulty, composition }
    : {
        status: "out-of-range",
        reason: "unlisted-combination",
        composition,
        optimalMoveCount: analysis.features.optimalMoveCount,
        shape,
      };
}
