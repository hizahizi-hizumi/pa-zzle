import type { BridgesDifficultyAnalysis } from "@/games/bridges/problem/difficulty-analysis";
import {
  type BridgesBoardSize,
  type BridgesGenerationConditions,
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
 * 1つのレベルが求める組み合わせ。
 * - `boardSize`: 盤面の一辺。読む範囲と架ける量で、単独でレベルを決めないよう隣のレベルと重なる範囲で許す。
 * - `islandCount`: 島の数。島が少なすぎて一目で解ける盤面を除く下限。
 * - `openingEdgeRatio`: 解き始めに数字の読みで狭められる行き先の割合（入口の広さ）。入口が広いほど、見るだけで次々に決まる。
 * - `countRoundCount`: 「ちょうど」で止まり「少なくとも1本はここへ」と読む手詰まりの回数。
 * - `connectivityRoundCount`: 数字の読みで止まり、つながり（閉じる組・孤立・唯一の通り道・1手の先読み）を読む手詰まりの回数。
 *   レベル3〜5 をこの回数で1か所・2か所・3か所以上に分ける。
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

const anyCount: NumericRange = {
  minimum: 0,
  maximum: Number.POSITIVE_INFINITY,
};

/**
 * 島の数の下限。上のレベルほど島が多い（合意）。下のレベルの典型（10 パーセンタイル）を下回るほど疎な盤面は、
 * 広い盤面でも見渡すだけで解けるので除く。6×6 で島が4〜6つの盤面も同じ。
 */
function atLeastIslands(minimum: number): NumericRange {
  return { minimum, maximum: Number.POSITIVE_INFINITY };
}

/**
 * 各レベルの組み合わせ。上のレベルは、盤面・島の数・つながりの手詰まり・数字だけでは決まらない割合の下限を下げず、
 * 入口の広さの上限を上げない。隣のレベルとは盤面の一辺を1つ共有し、共有する盤面では推論の特徴でだけレベルが分かれる。
 * 境界は人間の実プレイで確かめる前の暫定値。
 */
export const bridgesLevelCombinations = {
  "1": {
    boardSize: { minimum: 6, maximum: 7 },
    islandCount: atLeastIslands(7),
    // 入口が全部の問題（解き始めに全行き先が狭まる）は、読むところが無いので除く。
    openingEdgeRatio: { minimum: 0.5, maximum: 0.95 },
    countRoundCount: { minimum: 0, maximum: 0 },
    connectivityRoundCount: { minimum: 0, maximum: 0 },
    countReasoningUndecidedRatio: { minimum: 0, maximum: 0 },
  },
  "2": {
    boardSize: { minimum: 7, maximum: 8 },
    islandCount: atLeastIslands(9),
    openingEdgeRatio: { minimum: 0, maximum: 0.45 },
    countRoundCount: { minimum: 1, maximum: Number.POSITIVE_INFINITY },
    connectivityRoundCount: { minimum: 0, maximum: 0 },
    countReasoningUndecidedRatio: { minimum: 0, maximum: 0 },
  },
  "3": {
    boardSize: { minimum: 8, maximum: 9 },
    islandCount: atLeastIslands(12),
    openingEdgeRatio: { minimum: 0, maximum: 0.45 },
    countRoundCount: anyCount,
    connectivityRoundCount: { minimum: 1, maximum: 1 },
    countReasoningUndecidedRatio: { minimum: 0, maximum: 0.5 },
  },
  "4": {
    boardSize: { minimum: 9, maximum: 10 },
    islandCount: atLeastIslands(15),
    openingEdgeRatio: { minimum: 0, maximum: 0.45 },
    countRoundCount: anyCount,
    connectivityRoundCount: { minimum: 2, maximum: 2 },
    countReasoningUndecidedRatio: {
      minimum: 0.5,
      maximum: 1,
      excludesMinimum: true,
    },
  },
  "5": {
    boardSize: { minimum: 10, maximum: 10 },
    islandCount: atLeastIslands(18),
    openingEdgeRatio: { minimum: 0, maximum: 0.45 },
    countRoundCount: anyCount,
    // つながりの手詰まりが7回以上の問題は帯の中で突出して重い（問題集の 90 パーセンタイルは 4）ので、上限を置く。
    connectivityRoundCount: { minimum: 3, maximum: 6 },
    countReasoningUndecidedRatio: {
      minimum: 0.6,
      maximum: 1,
      excludesMinimum: true,
    },
  },
} as const satisfies Record<BridgesDifficulty, BridgesLevelCombination>;

/** 分類に使った特徴。 */
export type BridgesAssessedFeatures = {
  boardSize: number;
  islandCount: number;
  openingEdgeRatio: number;
  countRoundCount: number;
  connectivityRoundCount: number;
  countReasoningUndecidedRatio: number;
};

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

function matchesLevelCombination(
  features: BridgesAssessedFeatures,
  combination: BridgesLevelCombination,
): boolean {
  return (Object.keys(combination) as (keyof BridgesLevelCombination)[]).every(
    (key) => isInNumericRange(features[key], combination[key]),
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
      const features = {
        boardSize: scale.size,
        islandCount: scale.islandCount,
        openingEdgeRatio: reasoning.openingEdgeRatio,
        countRoundCount: reasoning.countRoundCount,
        connectivityRoundCount: reasoning.connectivityRoundCount,
        countReasoningUndecidedRatio: reasoning.countReasoningUndecidedRatio,
      };
      const difficulty = difficultyLevels.find(({ id }) =>
        matchesLevelCombination(features, bridgesLevelCombinations[id]),
      )?.id;
      return difficulty
        ? { status: "classified", difficulty, features }
        : { status: "out-of-range", reason: "unlisted-combination", features };
    }
  }
}

/**
 * レベルの盤面の範囲に入る生成条件をすべて挙げる。問題の候補を作る範囲に使う。
 * 密度・2本の割合・輪の割合はレベルの判定条件ではなく、候補の分布を寄せる生成条件なので、どのレベルにも全ての値を挙げる。
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
            bridgesSplitRates.map((splitRate) => ({
              size,
              islandDensity,
              doubleBridgeRate,
              extraBridgeRate,
              splitRate,
            })),
          ),
        ),
      ),
    );
}
