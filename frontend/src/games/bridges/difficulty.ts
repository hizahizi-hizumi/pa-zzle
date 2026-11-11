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

/**
 * 1つのレベルが求める、規模と数字の読みの組み合わせ。
 * - `boardSize`: 盤面の一辺。読む範囲と架ける量で、単独でレベルを決めないよう隣のレベルと重なる範囲で許す。
 * - `islandCount`: 島の数。下のレベルでは一目で解ける盤面を除く下限、上の2つのレベルでは規模で分ける範囲。
 * - `openingEdgeRatio`: 解き始めに数字の読みで狭められる行き先の割合（入口の広さ）。入口が広いほど、見るだけで次々に決まる。
 * - `countRoundCount`: 「少なくとも・多くとも」（2本と1本の配分）が要った数字の読みのまとまりの数。数字の読みを続けて当てた
 *   まとまりを、つながりの読みで区切って1つと数える。
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
 * - `readingRoundCount`: 「ちょうど」だけでは進めない読みの回数（配分が要った数字の読みのまとまりと、つながりの手詰まりの和）。
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
 * レベル3〜5 の数字と形の質。数字の平均を 3.0 以上にし、大きい数字と2本の配分を読む所を増やす。
 */
const upperClueQuality = {
  ...clueQuality,
  clueMean: atLeast(3),
} as const satisfies Partial<BridgesLevelReading>;

/**
 * レベル1（6×6・7×7、島10前後）の数字と形の質。島が少ないので1島で割合が1割近く動くので、最も多い数字・数字2の上限を
 * 1段緩める。外周に沿う橋は、一本道で枠をなぞる問題に戻さないよう、ほかのレベルより厳しくする。
 */
const smallBoardClueQuality = {
  ...clueQuality,
  dominantClueShare: atMost(0.4),
  twoClueShare: atMost(0.35),
  borderBridgeShare: atMost(0.45),
} as const satisfies Partial<BridgesLevelReading>;

/**
 * 各レベルの規模と数字の読みの組み合わせ。上のレベルは、盤面・数字の読みの手詰まり・つながりの手詰まりの下限を下げず、
 * 入口の広さの上限を上げない。隣のレベルとは盤面の一辺を1つ共有し、共有する盤面では手筋でだけレベルが分かれる。
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

/**
 * 各レベルが求める手筋。下から順に、新しい読みを1つずつ足す。
 * - レベル1: 最大の本数で決まる島（決め打ち）と行き先が1つの島から決まる。「少なくとも1本」の配分は1か所まで、交差で塞がる
 *   行き先は2つまで。外周に沿う橋はほかのレベルより少なくする。
 * - レベル2: 「少なくとも1本」の配分と、2島を閉じない読みを1回。
 * - レベル3: 閉じない読みを含むつながりの読みを2回以上と、交差で行き先が消える読み。5以上の数字の島があり、数字の平均が 3 以上。
 * - レベル4: 1か所の1手の先読みと、数字の読みの区切り2回以上を合わせた読み5回以上。5以上の数字の島が2つ以上。
 * - レベル5: 先読みが2か所以上で要り、組が閉じるか孤立するのを見る先読みを含む。読み6回以上。
 *   島が多く、5以上の数字が3つ以上、6以上も並ぶ。
 *   先読みの場所の数は `bridgesLevelStructures`。
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
    crossingBlockCount: atMost(2),
    highClueCount: unbounded,
    veryHighClueCount: unbounded,
    loopCount: unbounded,
    islandShare: unbounded,
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

/**
 * 1つのレベルが求める、盤面の形と読みの山場の置き所。
 * - `diagonalNeighborShare`: 斜め隣に島がある島の割合。島が市松に固まり、行き先が隣の島ばかりの盤面を除く。
 * - `shortBridgeShare`・`longBridgeCount`: 間が1マスの橋の割合と、盤面の一辺の半分以上の橋の数。隣をつなぐだけの盤面を除く。
 * - `borderIslandShare`: 外周の行・列にある島の割合。枠に島が並び、内側が空く盤面を除く。
 * - `lookaheadSpotCount`・`longestLookaheadChain`: 1手の先読みが要った場所の数と、1つの場所で続けて要った先読みの数の最大。
 * - `lastConnectivityDecidedRatio`: 最後のつながりの読みの前に本数が決まっていた行き先の割合。読みの山場が解き始めに偏り、
 *   残りが決め打ちの連鎖だけになる問題を除く。
 */
export type BridgesLevelStructure = {
  diagonalNeighborShare: NumericRange;
  borderIslandShare: NumericRange;
  shortBridgeShare: NumericRange;
  longBridgeCount: NumericRange;
  lookaheadSpotCount: NumericRange;
  longestLookaheadChain: NumericRange;
  lastConnectivityDecidedRatio: NumericRange;
};

/**
 * L1・L2 に求める盤面の形。斜め隣の島は半分まで、間が1マスの橋は 60% まで、長い橋は1本以上。6×6〜8×8 は外周のマスが
 * 盤面の4〜6割を占め、外周の各行・列に島を置くので、外周の島の割合は問わない。
 */
const smallLayoutShape = {
  diagonalNeighborShare: atMost(0.5),
  borderIslandShare: unbounded,
  shortBridgeShare: atMost(0.6),
  longBridgeCount: atLeast(1),
} as const satisfies Partial<BridgesLevelStructure>;

/**
 * L3〜L5 に求める盤面の形。間が1マスの橋と外周の島はどちらも 50% まで。どちらも少ない候補を、問題集を選ぶときの点で先に採る。
 * 45% までにすると、9×9・10×10 で残る盤面は長い橋で広がった疎な盤面ばかりで、つながりの読みが要らず、L4・L5 に当たる候補が
 * 0.4〜0.6% に減る（一時スクリプト）。
 */
const layoutShape = {
  ...smallLayoutShape,
  borderIslandShare: atMost(0.5),
  shortBridgeShare: atMost(0.5),
} as const satisfies Partial<BridgesLevelStructure>;

/** 1手の先読みを求めるレベルで、最後のつながりの読みの置き所の下限。 */
const LATE_CLIMAX_MINIMUM = 0.5;

/**
 * 各レベルが求める盤面の形と、先読みの場所と読みの山場。L4 は1つの場所で1つの先読み（同じ辺を続けて狭める先読みは1つと
 * 数え、同じ手詰まりでも離れた所は別の場所と数える）、L5 は2か所以上で先読みが要り、長い橋が2本以上ある。L4 と L5 は先読みの
 * 場所の数で分かれ、重ならない。
 */
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

/** 分類に使った特徴。 */
export type BridgesAssessedFeatures = Record<
  | keyof BridgesLevelCombination
  | keyof BridgesLevelReading
  | keyof BridgesLevelStructure,
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
        diagonalNeighborShare: scale.diagonalNeighborShare,
        borderIslandShare: scale.borderIslandShare,
        shortBridgeShare: scale.shortBridgeShare,
        longBridgeCount: scale.longBridgeCount,
        lookaheadSpotCount: reasoning.lookaheadSpotCount,
        longestLookaheadChain: reasoning.longestLookaheadChain,
        lastConnectivityDecidedRatio: reasoning.lastConnectivityDecidedRatio,
      };
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

/**
 * レベルごとに、候補を磨く向き。磨く点が向きの読みを増やすので、そのレベルが求める読みの向きで磨く。
 */
const refinementGoalByLevel = {
  "1": "entry",
  "2": "count",
  "3": "closure",
  "4": "lookahead",
  "5": "spots",
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

/** 点対称の配置の候補も作るレベル。札の割合で、そのレベルの一部を点対称の配置にする。 */
const symmetricLevels: ReadonlySet<BridgesDifficulty> = new Set([
  "3",
  "4",
  "5",
]);

/**
 * レベルの盤面の範囲に入る生成条件をすべて挙げる。問題の候補を作る範囲に使う。
 * 2本の割合・輪の割合・分割の割合はレベルの判定条件ではなく、候補の分布を寄せる生成条件なので、どのレベルにも全ての値を挙げる。
 * 島の割合は、盤面の大きさごとに、置く島の数がレベルの島の数の範囲に入る値だけを、同じ島の数になる値は最も小さい1つだけ挙げる。磨く回数・磨く向きは、レベルに
 * 当たりやすい値に絞る。L3〜L5 は点対称の配置の条件も挙げる。
 */
export function listBridgesGenerationConditions(
  difficulty: BridgesDifficulty,
): BridgesGenerationConditions[] {
  const { boardSize, islandCount } = bridgesLevelCombinations[difficulty];
  const symmetries = symmetricLevels.has(difficulty)
    ? bridgesLayoutSymmetries
    : (["none"] as const);
  return bridgesBoardSizes
    .filter((size) => isInNumericRange(size, boardSize))
    .flatMap((size) =>
      bridgesIslandDensities
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
