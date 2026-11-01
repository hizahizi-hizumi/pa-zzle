import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";
import type {
  HitofudePuzzleDifficultyAnalysis,
  HitofudePuzzleReasoningFeatures,
} from "@/games/hitofude-puzzle/problem/difficulty-analysis";
import {
  type HitofudePuzzleBoardSize,
  type HitofudePuzzleGenerationConditions,
  hitofudePuzzleBoardSizes,
  hitofudePuzzleTargetLookaheadLoads,
} from "@/games/hitofude-puzzle/problem/problem";

export type HitofudePuzzleDifficulty = DifficultyLevel;

/**
 * 1つのレベルが求める組み合わせ。
 * - `localReasoningSuffices`: 局所の推論（角・通路・袋小路、輪と端の連結の禁止）だけで道が決まるか。
 *   レベル1だけが真で、それより上は局所の推論で止まる地点を少なくとも1つ持つ。
 * - `lookaheadLoad`: 先読みの重さ（仮置きで進めた局面の数に、8手を超える長い先読みの段を足したもの）。
 *   レベルの挑戦の中身（数手先の破綻を読む局面の多さと深さ）を決める。
 * - `boardSize`: 盤面の一辺。読む範囲となぞる長さで、単独でレベルを決めないよう隣のレベルと重なる範囲で許す。
 */
export type HitofudePuzzleLevelCombination = {
  localReasoningSuffices: boolean;
  lookaheadLoad: NumericRange;
  boardSize: NumericRange<HitofudePuzzleBoardSize>;
};

/**
 * 各レベルの組み合わせ。先読みの重さを1段ずつ上げ、盤面サイズの範囲は両端とも下げない。
 * 隣のレベルとは盤面サイズの範囲が重なり、重なった盤面では先読みの重さでレベルが分かれる。
 * 境界は人間の実プレイで確かめる前の暫定値。
 */
export const hitofudePuzzleLevelCombinations = {
  "1": {
    localReasoningSuffices: true,
    lookaheadLoad: { minimum: 0, maximum: 0 },
    boardSize: { minimum: 5, maximum: 6 },
  },
  "2": {
    localReasoningSuffices: false,
    lookaheadLoad: { minimum: 0, maximum: 1 },
    boardSize: { minimum: 6, maximum: 7 },
  },
  "3": {
    localReasoningSuffices: false,
    lookaheadLoad: { minimum: 2, maximum: 2 },
    boardSize: { minimum: 7, maximum: 8 },
  },
  "4": {
    localReasoningSuffices: false,
    lookaheadLoad: { minimum: 3, maximum: 3 },
    boardSize: { minimum: 7, maximum: 8 },
  },
  "5": {
    localReasoningSuffices: false,
    lookaheadLoad: { minimum: 4, maximum: Number.POSITIVE_INFINITY },
    boardSize: { minimum: 8, maximum: 8 },
  },
} as const satisfies Record<
  HitofudePuzzleDifficulty,
  HitofudePuzzleLevelCombination
>;

type HitofudePuzzleAssessedReasoning = Pick<
  HitofudePuzzleReasoningFeatures,
  "assumptionCount" | "longestRefutationLength" | "lookaheadLoad"
>;

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、組み合わせがいずれかのレベルに当たった。
 * - `out-of-range`: 評価できるが提供しない。
 *   - `too-light`: 始点から引き進めると、すぐ見える取り残しを避けるだけで道が1通りに決まり、迷う分岐が無い。
 *   - `too-heavy`: 1段仮置きでは決まらず、2段仮置き（仮定の中でさらに仮定を重ねる）を要する。
 *   - `unlisted-combination`: 推論と盤面サイズの組み合わせがどのレベルにも当たらない。
 * - `unsupported`: 一意解だが、2段仮置きまで使っても道が決まらない、または分析の作業量の上限に達した。
 * - `invalid`: 解が無い、または2つ以上あり、問題として成立しない。
 */
export type HitofudePuzzleDifficultyAssessment = DifficultyAssessment<{
  classified: { reasoning: HitofudePuzzleAssessedReasoning };
  outOfRange:
    | { reason: "too-light" | "too-heavy" }
    | {
        reason: "unlisted-combination";
        reasoning: HitofudePuzzleAssessedReasoning;
      };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

function matchesLevelCombination(
  reasoning: HitofudePuzzleReasoningFeatures,
  size: number,
  combination: HitofudePuzzleLevelCombination,
): boolean {
  return (
    combination.localReasoningSuffices === reasoning.localReasoningSuffices &&
    isInNumericRange(reasoning.lookaheadLoad, combination.lookaheadLoad) &&
    isInNumericRange(size, combination.boardSize)
  );
}

export function assessHitofudePuzzleDifficulty(
  analysis: HitofudePuzzleDifficultyAnalysis,
): HitofudePuzzleDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed": {
      const { reasoning, drawing, scale } = analysis;
      if (reasoning.deepAssumptionCount > 0) {
        return { status: "out-of-range", reason: "too-heavy" };
      }
      if (drawing.fatalBranchCount === 0) {
        return { status: "out-of-range", reason: "too-light" };
      }
      const assessedReasoning = {
        assumptionCount: reasoning.assumptionCount,
        longestRefutationLength: reasoning.longestRefutationLength,
        lookaheadLoad: reasoning.lookaheadLoad,
      };
      const difficulty = difficultyLevels.find(({ id }) =>
        matchesLevelCombination(
          reasoning,
          scale.size,
          hitofudePuzzleLevelCombinations[id],
        ),
      )?.id;
      return difficulty
        ? { status: "classified", difficulty, reasoning: assessedReasoning }
        : {
            status: "out-of-range",
            reason: "unlisted-combination",
            reasoning: assessedReasoning,
          };
    }
  }
}

/**
 * レベルの盤面サイズの範囲に入る生成条件（盤面サイズと先読みの重さの目標の組）をすべて挙げる。問題の候補を作る範囲に使う。
 * 先読みの重さの目標はレベルの判定条件ではなく、候補の分布を寄せる生成条件なので、どのレベルにも全ての値を挙げる。
 */
export function listHitofudePuzzleGenerationConditions(
  difficulty: HitofudePuzzleDifficulty,
): HitofudePuzzleGenerationConditions[] {
  const { boardSize } = hitofudePuzzleLevelCombinations[difficulty];
  return hitofudePuzzleBoardSizes
    .filter((size) => isInNumericRange(size, boardSize))
    .flatMap((size) =>
      hitofudePuzzleTargetLookaheadLoads.map((targetLookaheadLoad) => ({
        size,
        targetLookaheadLoad,
      })),
    );
}
