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

export type HitofudePuzzleLevelCombination = {
  localReasoningSuffices: boolean;
  lookaheadLoad: NumericRange;
  boardSize: NumericRange<HitofudePuzzleBoardSize>;
};

/** 境界は人間の実プレイで確かめる前の暫定値。 */
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

export function listHitofudePuzzleGenerationConditions(
  difficulty: HitofudePuzzleDifficulty,
): HitofudePuzzleGenerationConditions[] {
  const { boardSize } = hitofudePuzzleLevelCombinations[difficulty];
  return hitofudePuzzleBoardSizes
    .filter((size) => isInNumericRange(size, boardSize))
    .flatMap((size) =>
      // 先読みの重さの目標はレベルの判定条件ではなく、候補の分布を寄せる生成条件なので、どのレベルにも全ての値を挙げる。
      hitofudePuzzleTargetLookaheadLoads.map((targetLookaheadLoad) => ({
        size,
        targetLookaheadLoad,
      })),
    );
}
