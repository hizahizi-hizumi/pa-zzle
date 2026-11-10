import type { BridgesDifficultyAnalysis } from "@/games/bridges/problem/difficulty-analysis";
import {
  type BridgesBoardSize,
  type BridgesGenerationConditions,
  type BridgesIslandDensity,
  type BridgesRefinementGoal,
  type BridgesRefinementSteps,
  bridgesBoardSizes,
  bridgesDoubleBridgeRates,
  bridgesExtraBridgeRates,
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
 * 1つのレベルが求める、要る手筋の種類と深さと、盤面の数字と形の質。
 * - `readingRoundCount`: 「ちょうど」だけでは止まり、ほかの読みが要った手詰まりの回数。
 * - `openingSaturatedIslandCount`: 解き始めの決め打ち（見ただけで全部の行き先が決まる数字3以上の島）の数。
 * - `closureRoundCount`: 閉じない読み（2島・3島以上の組）で、1〜2組だけが決まる一か所の気づきの回数。
 *   多くの組がまとめて決まる手詰まりは、同じ規則で盤面を掃く作業なので数えない。
 * - `groupClosureRoundCount`: 3島以上の組を閉じない読みが要った手詰まりの回数。
 * - `passageRoundCount`: 唯一の通り道の読みが要った手詰まりの回数。
 * - `lookaheadRoundCount`: 1手の先読みが要った手詰まりの回数。
 * - `countLookaheadRoundCount`: 1手の先読みのうち、本数が破れるのを見て退けた回数。
 * - `groupLookaheadRoundCount`: 1手の先読みのうち、3島以上の組が閉じるか数島が孤立するのを見て退けた回数。
 * - `chainedLookaheadRoundCount`: 1手の先読みのうち、前の先読みからすぐ続けて要った回数。
 * - `crossingBlockCount`: 交差で塞がり、数字の読みを進めた行き先の数。
 * - `clueMean`・`highClueCount`・`veryHighClueCount`・`dominantClueShare`・`twoClueShare`・`doubleBridgeRatio`:
 *   数字の平均、5以上・6以上の数字の島の数、最も多い数字の割合、数字2の割合、2本の組の割合。単調な盤面を除く。
 * - `loopCount`・`borderBridgeShare`: 解の輪の数と、外周に沿う橋の割合。木と枠をなぞる問題を除く。
 * - `usedEdgeShare`: 行き先のうち橋を架ける組の割合。どこへ架けるかを選ぶ所の無い問題を除く。
 * - `islandShare`: 盤面のマスに対する島の数の割合。同じレベルの中で、盤面の大きさによらず島の込み具合をそろえる。
 */
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
 * レベルごとの、盤面のマスに対する島の数の割合の下限。同じレベルの中では、盤面の大きさによらず島の込み具合をそろえる。
 * 下のレベルほど疎だと、行き先が少なく交わる行き先も少ないので、盤面が広くても見渡すだけで決まる。レベル4 は 10×10 で 22、
 * レベル5 は 26（10×10 に広げられる島の数の上の方）にする。
 */
const minimumIslandShareByLevel = {
  "1": 0.24,
  "2": 0.24,
  "3": 0.24,
  "4": 0.22,
  "5": 0.26,
} as const satisfies Record<BridgesDifficulty, number>;

/** そのレベルの最も小さい盤面での島の数の下限。 */
function islandLowerBound(
  difficulty: BridgesDifficulty,
  boardSize: NumericRange<BridgesBoardSize>,
): number {
  return Math.ceil(
    boardSize.minimum *
      boardSize.minimum *
      minimumIslandShareByLevel[difficulty],
  );
}

/**
 * どのレベルにも求める数字と形の質。手作りの良問に近い所に置く。数字の平均が低い盤面、同じ数字か 2 が並ぶ単調な盤面、
 * 2本の組が3割に満たない盤面は、1か所ずつの読みが「足りる・足りない」の確かめだけになる。外周に沿う橋が半分を超える盤面は、
 * 盤面の枠をなぞる問題になる。架ける行き先が 85% を超える盤面は、どこへ架けるかを選ぶ所が無い。数字2 と最も多い数字と
 * 平均は、評価役の案（30%・35%・2.8）より少し緩めた。10×10 で磨いた候補の多くが数字2 31〜33%・平均 2.75〜2.8 に集まり、
 * 案のままでは L5 の各500問を作るのに数時間かかる。
 */
const clueQuality = {
  clueMean: atLeast(2.75),
  dominantClueShare: atMost(0.36),
  twoClueShare: atMost(0.32),
  doubleBridgeRatio: atLeast(0.3),
  borderBridgeShare: atMost(0.5),
  usedEdgeShare: atMost(0.85),
} as const satisfies Partial<BridgesLevelReading>;

/**
 * レベル1（6×6・7×7、島10前後）の数字と形の質。島が少ないので1島で割合が1割近く動き、外周のマスも盤面の半分を超える。
 * 同じ割合を求めると候補がほとんど残らないので、最も多い数字・数字2・外周に沿う橋の上限を1段緩める。
 */
const smallBoardClueQuality = {
  ...clueQuality,
  dominantClueShare: atMost(0.4),
  twoClueShare: atMost(0.35),
  borderBridgeShare: atMost(0.55),
} as const satisfies Partial<BridgesLevelReading>;

/**
 * 各レベルの規模と数字の読みの組み合わせ。上のレベルは、盤面・数字の読みの手詰まり・つながりの手詰まりの下限を下げず、
 * 入口の広さの上限を上げない。隣のレベルとは盤面の一辺を1つ共有し、共有する盤面では手筋でだけレベルが分かれる。
 * 境界は人間の実プレイで確かめる前の暫定値。
 */
export const bridgesLevelCombinations = {
  "1": {
    boardSize: { minimum: 6, maximum: 7 },
    islandCount: atLeast(islandLowerBound("1", { minimum: 6, maximum: 7 })),
    openingEdgeRatio: { minimum: 0.3, maximum: 0.95 },
    countRoundCount: atMost(1),
    connectivityRoundCount: none,
    countReasoningUndecidedRatio: unbounded,
  },
  "2": {
    boardSize: { minimum: 7, maximum: 8 },
    islandCount: atLeast(islandLowerBound("2", { minimum: 7, maximum: 8 })),
    openingEdgeRatio: atMost(0.6),
    countRoundCount: atLeast(2),
    connectivityRoundCount: { minimum: 1, maximum: 1 },
    countReasoningUndecidedRatio: unbounded,
  },
  "3": {
    boardSize: { minimum: 8, maximum: 9 },
    islandCount: atLeast(islandLowerBound("3", { minimum: 8, maximum: 9 })),
    openingEdgeRatio: atMost(0.6),
    countRoundCount: atLeast(2),
    connectivityRoundCount: atLeast(2),
    countReasoningUndecidedRatio: unbounded,
  },
  "4": {
    boardSize: { minimum: 9, maximum: 10 },
    islandCount: atLeast(islandLowerBound("4", { minimum: 9, maximum: 10 })),
    openingEdgeRatio: atMost(0.6),
    countRoundCount: atLeast(2),
    connectivityRoundCount: atLeast(3),
    countReasoningUndecidedRatio: unbounded,
  },
  "5": {
    boardSize: { minimum: 10, maximum: 10 },
    islandCount: atLeast(islandLowerBound("5", { minimum: 10, maximum: 10 })),
    openingEdgeRatio: atMost(0.6),
    countRoundCount: atLeast(3),
    connectivityRoundCount: atLeast(3),
    countReasoningUndecidedRatio: unbounded,
  },
} as const satisfies Record<BridgesDifficulty, BridgesLevelCombination>;

/**
 * 各レベルが求める手筋。下から順に、新しい読みを1つずつ足す。
 * - レベル1: 最大の本数で決まる島（決め打ち）と行き先が1つの島から決まる。「少なくとも1本」の配分は1か所まで。
 * - レベル2: 「少なくとも1本」の配分を2回以上と、2島を閉じない読みを1回。
 * - レベル3: 閉じない読みを含むつながりの読みを2回以上と、交差で行き先が消える読み。
 * - レベル4: 1手の先読み。本数が破れるのを見る先読みと、組が閉じるか孤立するのを見る先読みの両方が要り、読みの手詰まりが6回以上。
 * - レベル5: 先読みが2回以上要り、先読みの結果からすぐ次の先読みが要る（先読みの連鎖）。島が多く、大きい数字が並ぶ。
 */
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
    crossingBlockCount: unbounded,
    highClueCount: unbounded,
    veryHighClueCount: unbounded,
    loopCount: unbounded,
    islandShare: atLeast(minimumIslandShareByLevel["1"]),
  },
  "2": {
    ...clueQuality,
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
    islandShare: atLeast(minimumIslandShareByLevel["2"]),
  },
  "3": {
    ...clueQuality,
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
    highClueCount: unbounded,
    veryHighClueCount: unbounded,
    loopCount: atLeast(1),
    islandShare: atLeast(minimumIslandShareByLevel["3"]),
  },
  "4": {
    ...clueQuality,
    readingRoundCount: atLeast(6),
    openingSaturatedIslandCount: unbounded,
    closureRoundCount: atLeast(1),
    groupClosureRoundCount: unbounded,
    passageRoundCount: unbounded,
    lookaheadRoundCount: atLeast(1),
    countLookaheadRoundCount: atLeast(1),
    groupLookaheadRoundCount: atLeast(1),
    chainedLookaheadRoundCount: none,
    crossingBlockCount: atLeast(1),
    highClueCount: atLeast(1),
    veryHighClueCount: unbounded,
    loopCount: atLeast(2),
    islandShare: atLeast(minimumIslandShareByLevel["4"]),
  },
  "5": {
    ...clueQuality,
    readingRoundCount: atLeast(6),
    openingSaturatedIslandCount: unbounded,
    closureRoundCount: atLeast(1),
    groupClosureRoundCount: unbounded,
    passageRoundCount: unbounded,
    lookaheadRoundCount: atLeast(2),
    countLookaheadRoundCount: unbounded,
    groupLookaheadRoundCount: atLeast(1),
    chainedLookaheadRoundCount: atLeast(1),
    crossingBlockCount: atLeast(2),
    highClueCount: atLeast(2),
    veryHighClueCount: atLeast(1),
    loopCount: atLeast(2),
    islandShare: atLeast(minimumIslandShareByLevel["5"]),
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
 * レベルごとに、候補を磨く向き。磨く点が向きの読みを増やすので、そのレベルが求める読みの向きで磨く。
 */
const refinementGoalByLevel = {
  "1": "entry",
  "2": "count",
  "3": "closure",
  "4": "lookahead",
  "5": "lookahead",
} as const satisfies Record<BridgesDifficulty, BridgesRefinementGoal>;

/**
 * レベルごとに、候補を作るときに磨く回数。磨かない候補は数字の読みだけで解ける盤面に、磨いた候補はつながりと1手の先読みが
 * 要る盤面に寄るので、そのレベルに当たりやすい回数だけで候補を作る（どのレベルに入るかは分析で決める）。
 */
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

/**
 * レベルごとに、候補を作るときの島の数の下限（盤面のマスに対する割合）。レベルの島の数の下限と同じにして、届かない盤面は
 * 磨く前に作り直す（磨くのは重いので、当たらない盤面を磨かない）。
 */
const islandDensitiesByLevel = {
  "1": [0.24],
  "2": [0.24],
  "3": [0.24],
  "4": [0.22, 0.24],
  "5": [0.26],
} as const satisfies Record<BridgesDifficulty, readonly BridgesIslandDensity[]>;

/**
 * レベルの盤面の範囲に入る生成条件をすべて挙げる。問題の候補を作る範囲に使う。
 * 2本の割合・輪の割合・分割の割合はレベルの判定条件ではなく、候補の分布を寄せる生成条件なので、どのレベルにも全ての値を挙げる。
 * 島の割合の下限・磨く回数・磨く向きは、レベルに当たりやすい値に絞る。
 */
export function listBridgesGenerationConditions(
  difficulty: BridgesDifficulty,
): BridgesGenerationConditions[] {
  const { boardSize } = bridgesLevelCombinations[difficulty];
  return bridgesBoardSizes
    .filter((size) => isInNumericRange(size, boardSize))
    .flatMap((size) =>
      islandDensitiesByLevel[difficulty].flatMap((islandDensity) =>
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
                refinementGoal: refinementGoalByLevel[difficulty],
              })),
            ),
          ),
        ),
      ),
    );
}
