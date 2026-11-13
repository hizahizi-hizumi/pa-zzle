import type { BridgesDifficultyAnalysis } from "@/games/bridges/problem/difficulty-analysis";
import { countBridgesTargetIslands } from "@/games/bridges/problem/generation/island-spread";
import {
  type BridgesBoardSize,
  type BridgesGenerationConditions,
  type BridgesRefinementGoal,
  type BridgesRefinementSteps,
  bridgesBoardSizes,
  bridgesDoubleBridgeRates,
  bridgesExtraBridgeRates,
  bridgesIslandDensities,
  bridgesLayoutSymmetries,
  bridgesSplitRates,
} from "@/games/bridges/problem/problem";
import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";

export type BridgesDifficulty = DifficultyLevel;

export type BridgesLevelCombination = {
  boardSize: NumericRange<BridgesBoardSize>;
  islandCount: NumericRange;
  /** 入口が広いほど、見るだけで次々に決まる。 */
  openingEdgeRatio: NumericRange;
  countRoundCount: NumericRange;
  connectivityRoundCount: NumericRange;
  countReasoningUndecidedRatio: NumericRange;
};

export type BridgesLevelReading = {
  readingRoundCount: NumericRange;
  openingSaturatedIslandCount: NumericRange;
  closureRoundCount: NumericRange;
  groupClosureRoundCount: NumericRange;
  passageRoundCount: NumericRange;
  lookaheadRoundCount: NumericRange;
  countLookaheadRoundCount: NumericRange;
  groupLookaheadRoundCount: NumericRange;
  chainedLookaheadRoundCount: NumericRange;
  crossingBlockCount: NumericRange;
  clueMean: NumericRange;
  highClueCount: NumericRange;
  veryHighClueCount: NumericRange;
  dominantClueShare: NumericRange;
  twoClueShare: NumericRange;
  doubleBridgeRatio: NumericRange;
  loopCount: NumericRange;
  borderBridgeShare: NumericRange;
  usedEdgeShare: NumericRange;
  islandShare: NumericRange;
};

const unbounded: NumericRange = {
  minimum: 0,
  maximum: Number.POSITIVE_INFINITY,
};

const none: NumericRange = { minimum: 0, maximum: 0 };

function atLeast(minimum: number): NumericRange {
  return { minimum, maximum: Number.POSITIVE_INFINITY };
}

function atMost(maximum: number): NumericRange {
  return { minimum: 0, maximum };
}

/**
 * 手作りの良問に近い所に置く。数字の平均が低い盤面、同じ数字か 2 が並ぶ単調な盤面、
 * 2本の組が3割に満たない盤面は、1か所ずつの読みが「足りる・足りない」の確かめだけになる。外周に沿う橋が半分を超える盤面は、
 * 盤面の枠をなぞる問題になる。架ける行き先が 85% を超える盤面は、どこへ架けるかを選ぶ所が無い。
 */
const baseClueQuality = {
  // 10×10 で磨いた候補の多くが数字2 31〜33%・平均 2.75〜2.8 に集まり、数字2 30%・最も多い数字 35%・平均 2.8 では
  // L5 の各500問を作るのに数時間かかる。
  clueMean: atLeast(2.75),
  dominantClueShare: atMost(0.36),
  twoClueShare: atMost(0.32),
  doubleBridgeRatio: atLeast(0.3),
  borderBridgeShare: atMost(0.5),
  usedEdgeShare: atMost(0.85),
} as const satisfies Partial<BridgesLevelReading>;

const upperClueQuality = {
  ...baseClueQuality,
  // 大きい数字と2本の配分を読む所を増やす。
  clueMean: atLeast(3),
} as const satisfies Partial<BridgesLevelReading>;

const smallBoardClueQuality = {
  ...baseClueQuality,
  // 島が10前後と少なく、1島で割合が1割近く動くので、1段緩める。
  dominantClueShare: atMost(0.4),
  twoClueShare: atMost(0.35),
  // 一本道で枠をなぞる問題に戻さないよう、ほかのレベルより厳しくする。
  borderBridgeShare: atMost(0.45),
} as const satisfies Partial<BridgesLevelReading>;

/**
 * 盤面の一辺は、読む範囲と架ける量で単独でレベルを決めないよう、隣のレベルと重ねる。共有する盤面では手筋でだけレベルが分かれる。
 * 島の数は、下のレベルでは一目で解ける盤面を除く下限、上の2つのレベルでは規模で分ける範囲。
 * 境界は人間の実プレイで確かめる前の暫定値。
 */
export const bridgesLevelCombinations = {
  "1": {
    boardSize: { minimum: 6, maximum: 7 },
    islandCount: { minimum: 9, maximum: 12 },
    openingEdgeRatio: { minimum: 0.3, maximum: 0.95 },
    countRoundCount: atMost(1),
    connectivityRoundCount: none,
    countReasoningUndecidedRatio: unbounded,
  },
  "2": {
    boardSize: { minimum: 7, maximum: 8 },
    islandCount: { minimum: 13, maximum: 17 },
    openingEdgeRatio: atMost(0.6),
    countRoundCount: atLeast(1),
    connectivityRoundCount: { minimum: 1, maximum: 1 },
    countReasoningUndecidedRatio: unbounded,
  },
  "3": {
    boardSize: { minimum: 8, maximum: 9 },
    islandCount: { minimum: 17, maximum: 22 },
    openingEdgeRatio: atMost(0.6),
    countRoundCount: atLeast(1),
    connectivityRoundCount: atLeast(2),
    countReasoningUndecidedRatio: unbounded,
  },
  "4": {
    boardSize: { minimum: 9, maximum: 10 },
    islandCount: { minimum: 20, maximum: 22 },
    openingEdgeRatio: atMost(0.6),
    countRoundCount: atLeast(2),
    connectivityRoundCount: atLeast(3),
    countReasoningUndecidedRatio: unbounded,
  },
  "5": {
    boardSize: { minimum: 10, maximum: 10 },
    islandCount: { minimum: 24, maximum: 26 },
    openingEdgeRatio: atMost(0.6),
    countRoundCount: atLeast(2),
    connectivityRoundCount: atLeast(3),
    countReasoningUndecidedRatio: unbounded,
  },
} as const satisfies Record<BridgesDifficulty, BridgesLevelCombination>;

export const bridgesLevelReadings = {
  "1": {
    ...smallBoardClueQuality,
    readingRoundCount: atMost(1),
    openingSaturatedIslandCount: atLeast(1),
    closureRoundCount: none,
    groupClosureRoundCount: none,
    passageRoundCount: none,
    lookaheadRoundCount: none,
    countLookaheadRoundCount: none,
    groupLookaheadRoundCount: none,
    chainedLookaheadRoundCount: none,
    crossingBlockCount: atMost(2),
    highClueCount: unbounded,
    veryHighClueCount: unbounded,
    loopCount: unbounded,
    islandShare: unbounded,
  },
  "2": {
    ...baseClueQuality,
    readingRoundCount: unbounded,
    openingSaturatedIslandCount: atLeast(1),
    closureRoundCount: { minimum: 1, maximum: 1 },
    groupClosureRoundCount: none,
    passageRoundCount: none,
    lookaheadRoundCount: none,
    countLookaheadRoundCount: none,
    groupLookaheadRoundCount: none,
    chainedLookaheadRoundCount: none,
    crossingBlockCount: unbounded,
    highClueCount: unbounded,
    veryHighClueCount: unbounded,
    loopCount: atLeast(1),
    islandShare: unbounded,
  },
  "3": {
    ...upperClueQuality,
    readingRoundCount: unbounded,
    openingSaturatedIslandCount: unbounded,
    closureRoundCount: atLeast(1),
    groupClosureRoundCount: unbounded,
    passageRoundCount: unbounded,
    lookaheadRoundCount: none,
    countLookaheadRoundCount: none,
    groupLookaheadRoundCount: none,
    chainedLookaheadRoundCount: none,
    crossingBlockCount: atLeast(1),
    highClueCount: atLeast(1),
    veryHighClueCount: unbounded,
    loopCount: atLeast(1),
    islandShare: unbounded,
  },
  "4": {
    ...upperClueQuality,
    readingRoundCount: atLeast(5),
    openingSaturatedIslandCount: unbounded,
    closureRoundCount: atLeast(1),
    groupClosureRoundCount: unbounded,
    passageRoundCount: unbounded,
    lookaheadRoundCount: atLeast(1),
    countLookaheadRoundCount: unbounded,
    groupLookaheadRoundCount: unbounded,
    chainedLookaheadRoundCount: none,
    crossingBlockCount: atLeast(1),
    highClueCount: atLeast(2),
    veryHighClueCount: unbounded,
    loopCount: atLeast(2),
    islandShare: unbounded,
  },
  "5": {
    ...upperClueQuality,
    readingRoundCount: atLeast(6),
    openingSaturatedIslandCount: unbounded,
    closureRoundCount: atLeast(1),
    groupClosureRoundCount: unbounded,
    passageRoundCount: unbounded,
    lookaheadRoundCount: atLeast(2),
    countLookaheadRoundCount: unbounded,
    groupLookaheadRoundCount: atLeast(1),
    chainedLookaheadRoundCount: unbounded,
    crossingBlockCount: atLeast(2),
    highClueCount: atLeast(3),
    veryHighClueCount: atLeast(1),
    loopCount: atLeast(2),
    islandShare: unbounded,
  },
} as const satisfies Record<BridgesDifficulty, BridgesLevelReading>;

export type BridgesLevelStructure = {
  diagonalNeighborShare: NumericRange;
  borderIslandShare: NumericRange;
  /** `longBridgeCount` と合わせて、隣をつなぐだけの盤面を除く。 */
  shortBridgeShare: NumericRange;
  longBridgeCount: NumericRange;
  lookaheadSpotCount: NumericRange;
  longestLookaheadChain: NumericRange;
  /** 読みの山場が解き始めに偏り、残りが決め打ちの連鎖だけになる問題を除く。 */
  lastConnectivityDecidedRatio: NumericRange;
};

const smallLayoutShape = {
  diagonalNeighborShare: atMost(0.5),
  // 6×6〜8×8 は外周のマスが盤面の4〜6割を占め、外周の各行・列に島を置くので、外周の島の割合は問わない。
  borderIslandShare: unbounded,
  shortBridgeShare: atMost(0.6),
  longBridgeCount: atLeast(1),
} as const satisfies Partial<BridgesLevelStructure>;

const layoutShape = {
  ...smallLayoutShape,
  // どちらも少ない候補を、問題集を選ぶときの点で先に採る。
  // 45% までにすると、9×9・10×10 で残る盤面は長い橋で広がった疎な盤面ばかりで、つながりの読みが要らず、L4・L5 に当たる候補が
  // 0.4〜0.6% に減る（一時スクリプト）。
  borderIslandShare: atMost(0.5),
  shortBridgeShare: atMost(0.5),
} as const satisfies Partial<BridgesLevelStructure>;

const LATE_CLIMAX_MINIMUM = 0.5;

export const bridgesLevelStructures = {
  "1": {
    ...smallLayoutShape,
    lookaheadSpotCount: none,
    longestLookaheadChain: none,
    lastConnectivityDecidedRatio: unbounded,
  },
  "2": {
    ...smallLayoutShape,
    lookaheadSpotCount: none,
    longestLookaheadChain: none,
    lastConnectivityDecidedRatio: unbounded,
  },
  "3": {
    ...layoutShape,
    lookaheadSpotCount: none,
    longestLookaheadChain: none,
    lastConnectivityDecidedRatio: unbounded,
  },
  "4": {
    ...layoutShape,
    lookaheadSpotCount: { minimum: 1, maximum: 1 },
    longestLookaheadChain: { minimum: 1, maximum: 1 },
    lastConnectivityDecidedRatio: atLeast(LATE_CLIMAX_MINIMUM),
  },
  "5": {
    ...layoutShape,
    longBridgeCount: atLeast(2),
    lookaheadSpotCount: atLeast(2),
    longestLookaheadChain: atLeast(1),
    lastConnectivityDecidedRatio: atLeast(LATE_CLIMAX_MINIMUM),
  },
} as const satisfies Record<BridgesDifficulty, BridgesLevelStructure>;

export type BridgesAssessedFeatures = Record<
  | keyof BridgesLevelCombination
  | keyof BridgesLevelReading
  | keyof BridgesLevelStructure,
  number
>;

export type BridgesDifficultyAssessment = DifficultyAssessment<{
  classified: { features: BridgesAssessedFeatures };
  outOfRange:
    | { reason: "requires-trial" }
    | { reason: "unlisted-combination"; features: BridgesAssessedFeatures };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

function matchesRanges<Key extends keyof BridgesAssessedFeatures>(
  features: BridgesAssessedFeatures,
  ranges: Record<Key, NumericRange>,
): boolean {
  return (Object.keys(ranges) as Key[]).every((key) =>
    isInNumericRange(features[key], ranges[key]),
  );
}

export function assessBridgesDifficulty(
  analysis: BridgesDifficultyAnalysis,
): BridgesDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed": {
      if (analysis.requiresTrial) {
        return { status: "out-of-range", reason: "requires-trial" };
      }
      const { scale, reasoning } = analysis;
      // 素朴な解き方の戻した回数は乱数に左右されるので、分類には使わず記録だけにする。
      const features: BridgesAssessedFeatures = {
        boardSize: scale.size,
        islandCount: scale.islandCount,
        openingEdgeRatio: reasoning.openingEdgeRatio,
        countRoundCount: reasoning.countRoundCount,
        connectivityRoundCount: reasoning.connectivityRoundCount,
        countReasoningUndecidedRatio: reasoning.countReasoningUndecidedRatio,
        openingSaturatedIslandCount: reasoning.openingSaturatedIslandCount,
        closureRoundCount: reasoning.closureRoundCount,
        groupClosureRoundCount: reasoning.groupClosureRoundCount,
        passageRoundCount: reasoning.passageRoundCount,
        lookaheadRoundCount: reasoning.lookaheadRoundCount,
        countLookaheadRoundCount: reasoning.countLookaheadRoundCount,
        readingRoundCount: reasoning.readingRoundCount,
        groupLookaheadRoundCount: reasoning.groupLookaheadRoundCount,
        chainedLookaheadRoundCount: reasoning.chainedLookaheadRoundCount,
        crossingBlockCount: reasoning.crossingBlockCount,
        clueMean: scale.clueMean,
        highClueCount: scale.highClueCount,
        veryHighClueCount: scale.veryHighClueCount,
        dominantClueShare: scale.dominantClueShare,
        twoClueShare: scale.twoClueShare,
        doubleBridgeRatio: scale.doubleBridgeRatio,
        loopCount: scale.loopCount,
        borderBridgeShare: scale.borderBridgeShare,
        usedEdgeShare: scale.usedEdgeShare,
        islandShare: scale.islandShare,
        diagonalNeighborShare: scale.diagonalNeighborShare,
        borderIslandShare: scale.borderIslandShare,
        shortBridgeShare: scale.shortBridgeShare,
        longBridgeCount: scale.longBridgeCount,
        lookaheadSpotCount: reasoning.lookaheadSpotCount,
        longestLookaheadChain: reasoning.longestLookaheadChain,
        lastConnectivityDecidedRatio: reasoning.lastConnectivityDecidedRatio,
      };
      // どのレベルの組み合わせも重ならないので、当たるレベルは多くても1つ。
      const difficulty = difficultyLevels.find(
        ({ id }) =>
          matchesRanges(features, bridgesLevelCombinations[id]) &&
          matchesRanges(features, bridgesLevelReadings[id]) &&
          matchesRanges(features, bridgesLevelStructures[id]),
      )?.id;
      return difficulty
        ? { status: "classified", difficulty, features }
        : { status: "out-of-range", reason: "unlisted-combination", features };
    }
  }
}

// 磨く点が向きの読みを増やすので、そのレベルが求める読みの向きで磨く。
const refinementGoalByLevel = {
  "1": "entry",
  "2": "count",
  "3": "closure",
  "4": "lookahead",
  "5": "spots",
} as const satisfies Record<BridgesDifficulty, BridgesRefinementGoal>;

// 磨かない候補は数字の読みだけで解ける盤面に、磨いた候補はつながりと1手の先読みが要る盤面に寄るので、
// そのレベルに当たりやすい回数だけで候補を作る（どのレベルに入るかは分析で決める）。
const refinementStepsByLevel = {
  "1": [150, 500],
  "2": [500, 1500],
  "3": [500, 1500],
  "4": [2000],
  "5": [2000],
} as const satisfies Record<
  BridgesDifficulty,
  readonly BridgesRefinementSteps[]
>;

// 札の割合で、そのレベルの一部だけを点対称の配置にする。
const symmetricLayoutLevels: ReadonlySet<BridgesDifficulty> = new Set([
  "3",
  "4",
  "5",
]);

export function listBridgesGenerationConditions(
  difficulty: BridgesDifficulty,
): BridgesGenerationConditions[] {
  const { boardSize, islandCount } = bridgesLevelCombinations[difficulty];
  const symmetries = symmetricLayoutLevels.has(difficulty)
    ? bridgesLayoutSymmetries
    : (["none"] as const);
  return bridgesBoardSizes
    .filter((size) => isInNumericRange(size, boardSize))
    .flatMap((size) =>
      bridgesIslandDensities
        // 置く島の数がレベルの範囲に入る割合を、同じ島の数になる割合は最も小さい1つだけ挙げる。
        .filter(
          (islandDensity, index) =>
            isInNumericRange(
              countBridgesTargetIslands(size, islandDensity),
              islandCount,
            ) &&
            countBridgesTargetIslands(size, islandDensity) !==
              countBridgesTargetIslands(
                size,
                bridgesIslandDensities[index - 1] ?? 0,
              ),
        )
        .flatMap((islandDensity) =>
          // 2本の割合・輪の割合・分割の割合はレベルの判定条件ではなく、候補の分布を寄せる生成条件なので、どのレベルにも全ての値を挙げる。
          bridgesDoubleBridgeRates.flatMap((doubleBridgeRate) =>
            bridgesExtraBridgeRates.flatMap((extraBridgeRate) =>
              bridgesSplitRates.flatMap((splitRate) =>
                refinementStepsByLevel[difficulty].flatMap((refinementSteps) =>
                  symmetries.map((layoutSymmetry) => ({
                    size,
                    islandDensity,
                    doubleBridgeRate,
                    extraBridgeRate,
                    splitRate,
                    refinementSteps,
                    refinementGoal: refinementGoalByLevel[difficulty],
                    layoutSymmetry,
                  })),
                ),
              ),
            ),
          ),
        ),
    );
}
