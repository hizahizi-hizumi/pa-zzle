import type { BridgesDifficultyAnalysis } from "@/games/bridges/problem/difficulty-analysis";
import {
  type BridgesBoardSize,
  type BridgesGenerationConditions,
  type BridgesRefinementSteps,
  bridgesBoardSizes,
  bridgesDoubleBridgeRates,
  bridgesExtraBridgeRates,
  bridgesIslandDensities,
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

/**
 * 1つのレベルが求める、規模と数字の読みの組み合わせ。
 * - `boardSize`: 盤面の一辺。読む範囲と架ける量で、単独でレベルを決めないよう隣のレベルと重なる範囲で許す。
 * - `islandCount`: 島の数。下のレベルでは一目で解ける盤面を除く下限、上の2つのレベルでは規模で分ける範囲。
 * - `openingEdgeRatio`: 解き始めに数字の読みで狭められる行き先の割合（入口の広さ）。入口が広いほど、見るだけで次々に決まる。
 * - `countRoundCount`: 「ちょうど」で止まり「少なくとも・多くとも」（2本と1本の配分）を読む手詰まりの回数。
 * - `connectivityRoundCount`: 数字の読みで止まり、つながり（閉じる組・唯一の通り道・1手の先読み）を読む手詰まりの回数。
 * - `countReasoningUndecidedRatio`: 数字の読みだけでは決まらない行き先の割合。早くからつながりを読まなければならないほど大きい。
 */
export type BridgesLevelCombination = {
  boardSize: NumericRange<BridgesBoardSize>;
  islandCount: NumericRange;
  openingEdgeRatio: NumericRange;
  countRoundCount: NumericRange;
  connectivityRoundCount: NumericRange;
  countReasoningUndecidedRatio: NumericRange;
};

/**
 * 1つのレベルが求める、要る手筋の種類と深さと、盤面の数字の質。
 * - `openingSaturatedIslandCount`: 解き始めの決め打ち（見ただけで全部の行き先が決まる数字3以上の島）の数。
 * - `closureRoundCount`: 閉じない読み（2島・3島以上の組）で、1〜2組だけが決まる一か所の気づきの回数。
 *   多くの組がまとめて決まる手詰まりは、同じ規則で盤面を掃く作業なので数えない。
 * - `groupClosureRoundCount`: 3島以上の組を閉じない読みが要った手詰まりの回数。
 * - `passageRoundCount`: 唯一の通り道の読みが要った手詰まりの回数。
 * - `lookaheadRoundCount`: 1手の先読みが要った手詰まりの回数。
 * - `clueMean`・`highClueCount`・`dominantClueShare`・`doubleBridgeRatio`: 数字の平均、5以上の数字の島の数、
 *   最も多い数字の割合、2本の組の割合。1 と 2 ばかりの単調な盤面を除く。
 */
export type BridgesLevelReading = {
  openingSaturatedIslandCount: NumericRange;
  closureRoundCount: NumericRange;
  groupClosureRoundCount: NumericRange;
  passageRoundCount: NumericRange;
  lookaheadRoundCount: NumericRange;
  clueMean: NumericRange;
  highClueCount: NumericRange;
  dominantClueShare: NumericRange;
  doubleBridgeRatio: NumericRange;
};

const unbounded: NumericRange = {
  minimum: 0,
  maximum: Number.POSITIVE_INFINITY,
};

const none: NumericRange = { minimum: 0, maximum: 0 };

function atLeast(minimum: number): NumericRange {
  return { minimum, maximum: Number.POSITIVE_INFINITY };
}

/** 島の数の下限を決める、盤面のマスに対する島の割合（百分率）。 */
const MINIMUM_ISLAND_PERCENT = 18;

/**
 * そのレベルの最も小さい盤面のマスの 18% を島の数の下限にする。それより疎な盤面は島どうしが離れて行き先が少なく、
 * 盤面が広くても見渡すだけで橋が決まりやすく、広さが挑戦にならないという見込みで置く。上のレベルほど盤面が広いので、下限も上がる。
 */
function islandLowerBound(boardSize: NumericRange<BridgesBoardSize>): number {
  return Math.ceil(
    (boardSize.minimum * boardSize.minimum * MINIMUM_ISLAND_PERCENT) / 100,
  );
}

/** レベル4 と 5 を規模で分ける、島の数の境。10×10 の盤面に広げた島の数の中央値。 */
const LEVEL_FIVE_MINIMUM_ISLANDS = 25;

/**
 * どのレベルにも求める数字の質。数字の平均が低い盤面と、同じ数字が半分を超える単調な盤面と、2本の組が3割に満たない盤面は、
 * 1か所ずつの読みが「足りる・足りない」の確かめだけになるので出さない。
 */
const clueQuality = {
  clueMean: atLeast(2.6),
  dominantClueShare: { minimum: 0, maximum: 0.5 },
  doubleBridgeRatio: atLeast(0.3),
} as const satisfies Partial<BridgesLevelReading>;

/**
 * 各レベルの規模と数字の読みの組み合わせ。上のレベルは、盤面・数字の読みの手詰まり・つながりの手詰まりの下限を下げず、
 * 入口の広さの上限を上げない。隣のレベルとは盤面の一辺を1つ共有し、共有する盤面では手筋でだけレベルが分かれる。
 * レベル4 と 5 は、同じ 10×10 でも島の数（規模）で分かれる。境界は人間の実プレイで確かめる前の暫定値。
 */
export const bridgesLevelCombinations = {
  "1": {
    boardSize: { minimum: 6, maximum: 7 },
    islandCount: atLeast(islandLowerBound({ minimum: 6, maximum: 7 })),
    openingEdgeRatio: { minimum: 0.3, maximum: 0.95 },
    countRoundCount: none,
    connectivityRoundCount: { minimum: 0, maximum: 1 },
    countReasoningUndecidedRatio: { minimum: 0, maximum: 1 },
  },
  "2": {
    boardSize: { minimum: 7, maximum: 8 },
    islandCount: atLeast(islandLowerBound({ minimum: 7, maximum: 8 })),
    openingEdgeRatio: { minimum: 0, maximum: 0.6 },
    countRoundCount: atLeast(2),
    connectivityRoundCount: { minimum: 0, maximum: 1 },
    countReasoningUndecidedRatio: { minimum: 0, maximum: 1 },
  },
  "3": {
    boardSize: { minimum: 8, maximum: 9 },
    islandCount: atLeast(islandLowerBound({ minimum: 8, maximum: 9 })),
    openingEdgeRatio: { minimum: 0, maximum: 0.6 },
    countRoundCount: atLeast(2),
    connectivityRoundCount: atLeast(1),
    countReasoningUndecidedRatio: { minimum: 0, maximum: 1 },
  },
  "4": {
    boardSize: { minimum: 9, maximum: 10 },
    islandCount: {
      minimum: islandLowerBound({ minimum: 9, maximum: 10 }),
      maximum: LEVEL_FIVE_MINIMUM_ISLANDS - 1,
    },
    openingEdgeRatio: { minimum: 0, maximum: 0.6 },
    countRoundCount: atLeast(2),
    connectivityRoundCount: atLeast(2),
    countReasoningUndecidedRatio: { minimum: 0, maximum: 1 },
  },
  "5": {
    boardSize: { minimum: 10, maximum: 10 },
    islandCount: atLeast(LEVEL_FIVE_MINIMUM_ISLANDS),
    openingEdgeRatio: { minimum: 0, maximum: 0.6 },
    countRoundCount: atLeast(3),
    connectivityRoundCount: atLeast(3),
    countReasoningUndecidedRatio: { minimum: 0, maximum: 1 },
  },
} as const satisfies Record<BridgesDifficulty, BridgesLevelCombination>;

/**
 * 各レベルが求める手筋。
 * - レベル1: 決め打ちと、2島を閉じない読み（1 と 1 をつながない）まで。
 * - レベル2: 決め打ちに、2本と1本の配分（少なくとも1本）を読む。3島以上の組の読みと先読みは要らない。
 * - レベル3: 3島以上の組を閉じない読みか唯一の通り道が要る。1手の先読みは要らない。
 * - レベル4: 閉じない読みの一か所の気づきに加えて、1手の先読みが1回要る。大きい数字の島が1つ以上ある。
 * - レベル5: 閉じない読みの一か所の気づきに加えて、1手の先読みが2回以上要る。大きい数字の島が2つ以上ある。
 */
export const bridgesLevelReadings = {
  "1": {
    ...clueQuality,
    openingSaturatedIslandCount: atLeast(1),
    closureRoundCount: { minimum: 0, maximum: 1 },
    groupClosureRoundCount: none,
    passageRoundCount: none,
    lookaheadRoundCount: none,
    highClueCount: unbounded,
  },
  "2": {
    ...clueQuality,
    openingSaturatedIslandCount: atLeast(1),
    closureRoundCount: { minimum: 0, maximum: 1 },
    groupClosureRoundCount: none,
    passageRoundCount: none,
    lookaheadRoundCount: none,
    highClueCount: unbounded,
  },
  "3": {
    ...clueQuality,
    openingSaturatedIslandCount: unbounded,
    closureRoundCount: atLeast(1),
    groupClosureRoundCount: unbounded,
    passageRoundCount: unbounded,
    lookaheadRoundCount: none,
    highClueCount: unbounded,
  },
  "4": {
    ...clueQuality,
    openingSaturatedIslandCount: unbounded,
    closureRoundCount: atLeast(1),
    groupClosureRoundCount: unbounded,
    passageRoundCount: unbounded,
    lookaheadRoundCount: { minimum: 1, maximum: 1 },
    highClueCount: atLeast(1),
  },
  "5": {
    ...clueQuality,
    openingSaturatedIslandCount: unbounded,
    closureRoundCount: atLeast(1),
    groupClosureRoundCount: unbounded,
    passageRoundCount: unbounded,
    lookaheadRoundCount: atLeast(2),
    highClueCount: atLeast(2),
  },
} as const satisfies Record<BridgesDifficulty, BridgesLevelReading>;

/** 分類に使った特徴。 */
export type BridgesAssessedFeatures = Record<
  keyof BridgesLevelCombination | keyof BridgesLevelReading,
  number
>;

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、組み合わせがいずれかのレベルに当たった。
 * - `out-of-range`: 評価できるが提供しない。
 *   - `requires-trial`: 推理（段 A1〜D）では決まらず、試し置きが要る。推理だけで解ける問題だけを出す。
 *   - `unlisted-combination`: 特徴と盤面の組み合わせがどのレベルにも当たらない。
 * - `unsupported`: 一意解だが、試し置きまで使っても決まらない。
 * - `invalid`: 解が無い、2つ以上ある、または一意性を確かめる探索が上限に達した。
 */
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

/**
 * 分析結果を難易度へ分類する。どのレベルの組み合わせも重ならないので、当たるレベルは多くても1つ。
 * 素朴な解き方の戻した回数は乱数に左右されるので、分類には使わず記録だけにする。
 */
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
        clueMean: scale.clueMean,
        highClueCount: scale.highClueCount,
        dominantClueShare: scale.dominantClueShare,
        doubleBridgeRatio: scale.doubleBridgeRatio,
      };
      const difficulty = difficultyLevels.find(
        ({ id }) =>
          matchesRanges(features, bridgesLevelCombinations[id]) &&
          matchesRanges(features, bridgesLevelReadings[id]),
      )?.id;
      return difficulty
        ? { status: "classified", difficulty, features }
        : { status: "out-of-range", reason: "unlisted-combination", features };
    }
  }
}

/**
 * レベルごとに、候補を作るときに磨く回数。磨かない候補は数字の読みだけで解ける盤面に、磨いた候補はつながりと1手の先読みが
 * 要る盤面に寄るので、そのレベルに当たりやすい回数だけで候補を作る（どのレベルに入るかは分析で決める）。
 */
const refinementStepsByLevel = {
  "1": [0, 150],
  "2": [150, 500],
  "3": [150, 500],
  "4": [150, 500],
  "5": [1500],
} as const satisfies Record<
  BridgesDifficulty,
  readonly BridgesRefinementSteps[]
>;

/**
 * レベルの盤面の範囲に入る生成条件をすべて挙げる。問題の候補を作る範囲に使う。
 * 密度・2本の割合・輪の割合・分割の割合はレベルの判定条件ではなく、候補の分布を寄せる生成条件なので、どのレベルにも全ての値を挙げる。
 * 磨く回数だけは、レベルに当たりやすい値に絞る。
 */
export function listBridgesGenerationConditions(
  difficulty: BridgesDifficulty,
): BridgesGenerationConditions[] {
  const { boardSize } = bridgesLevelCombinations[difficulty];
  return bridgesBoardSizes
    .filter((size) => isInNumericRange(size, boardSize))
    .flatMap((size) =>
      bridgesIslandDensities.flatMap((islandDensity) =>
        bridgesDoubleBridgeRates.flatMap((doubleBridgeRate) =>
          bridgesExtraBridgeRates.flatMap((extraBridgeRate) =>
            bridgesSplitRates.flatMap((splitRate) =>
              refinementStepsByLevel[difficulty].map((refinementSteps) => ({
                size,
                islandDensity,
                doubleBridgeRate,
                extraBridgeRate,
                splitRate,
                refinementSteps,
              })),
            ),
          ),
        ),
      ),
    );
}
