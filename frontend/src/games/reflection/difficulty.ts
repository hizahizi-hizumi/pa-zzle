import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";
import type {
  ReflectionDifficultyAnalysis,
  ReflectionReasoningFeatures,
  ReflectionTrialFeatures,
} from "@/games/reflection/problem/difficulty-analysis";
import {
  type ReflectionBoardSize,
  type ReflectionGenerationConditions,
  reflectionBoardSizes,
} from "@/games/reflection/problem/problem";

export type ReflectionDifficulty = DifficultyLevel;

type ReflectionReasoningLevel = ReflectionReasoningFeatures["highestLevel"];

export type ReflectionLevelCombination = {
  reasoningLevel: ReflectionReasoningLevel;
  boardSize: NumericRange<ReflectionBoardSize>;
  pieceCount: NumericRange<number>;
  piecesPerClue?: NumericRange<number>;
  minimumTrialRetryCount?: number;
};

/**
 * 密な盤面ではピースが他のピースの陰に隠れて問題成立条件を満たしにくく、
 * 10×10 は20ピースまでしか安定して作れない。11×11 はレベル5 の密度の問題をほとんど作れないので、どのレベルにも含めない。
 * 境界は人間の実プレイで確かめる前の暫定値。
 */
export const reflectionLevelCombinations = {
  "1": {
    reasoningLevel: 1,
    boardSize: { minimum: 5, maximum: 5 },
    pieceCount: { minimum: 2, maximum: 4 },
  },
  "2": {
    reasoningLevel: 2,
    boardSize: { minimum: 5, maximum: 6 },
    pieceCount: { minimum: 2, maximum: 4 },
  },
  "3": {
    reasoningLevel: 3,
    boardSize: { minimum: 6, maximum: 7 },
    pieceCount: { minimum: 4, maximum: 8 },
  },
  "4": {
    reasoningLevel: 4,
    boardSize: { minimum: 7, maximum: 9 },
    pieceCount: { minimum: 8, maximum: 18 },
    piecesPerClue: { minimum: 0.28, maximum: 0.5 },
    minimumTrialRetryCount: 3,
  },
  "5": {
    reasoningLevel: 5,
    boardSize: { minimum: 9, maximum: 10 },
    pieceCount: { minimum: 17, maximum: 20 },
    piecesPerClue: { minimum: 0.47, maximum: 0.56 },
    minimumTrialRetryCount: 15,
  },
} as const satisfies Record<ReflectionDifficulty, ReflectionLevelCombination>;

export type ReflectionDifficultyAssessment = DifficultyAssessment<{
  classified: { reasoningLevel: ReflectionReasoningLevel };
  outOfRange: {
    reason: "unlisted-combination";
    reasoningLevel: ReflectionReasoningLevel;
  };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

function resistsTrial(
  trial: ReflectionTrialFeatures,
  minimumTrialRetryCount: number | undefined,
): boolean {
  return (
    minimumTrialRetryCount === undefined ||
    !trial.solved ||
    trial.retryCount >= minimumTrialRetryCount
  );
}

export function coversReflectionGenerationCondition(
  { boardSize, pieceCount, piecesPerClue }: ReflectionLevelCombination,
  condition: { size: number; pieceCount: number },
): boolean {
  return (
    isInNumericRange(condition.size, boardSize) &&
    isInNumericRange(condition.pieceCount, pieceCount) &&
    (piecesPerClue === undefined ||
      isInNumericRange(
        condition.pieceCount / (condition.size * 4),
        piecesPerClue,
      ))
  );
}

function matchesLevelCombination(
  reasoningLevel: ReflectionReasoningLevel,
  condition: { size: number; pieceCount: number },
  trial: ReflectionTrialFeatures,
  combination: ReflectionLevelCombination,
): boolean {
  return (
    combination.reasoningLevel === reasoningLevel &&
    coversReflectionGenerationCondition(combination, condition) &&
    resistsTrial(trial, combination.minimumTrialRetryCount)
  );
}

export function assessReflectionDifficulty(
  analysis: ReflectionDifficultyAnalysis,
): ReflectionDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed": {
      const { highestLevel } = analysis.features;
      const { size, pieceCount } = analysis.scale;
      const difficulty = difficultyLevels.find(({ id }) =>
        matchesLevelCombination(
          highestLevel,
          { size, pieceCount },
          analysis.trial,
          reflectionLevelCombinations[id],
        ),
      )?.id;
      return difficulty
        ? { status: "classified", difficulty, reasoningLevel: highestLevel }
        : {
            status: "out-of-range",
            reason: "unlisted-combination",
            reasoningLevel: highestLevel,
          };
    }
  }
}

export function listReflectionGenerationConditions(
  difficulty: ReflectionDifficulty,
): ReflectionGenerationConditions[] {
  const combination = reflectionLevelCombinations[difficulty];
  const { boardSize, pieceCount } = combination;
  return reflectionBoardSizes
    .filter((size) => isInNumericRange(size, boardSize))
    .flatMap((size) =>
      Array.from(
        { length: pieceCount.maximum - pieceCount.minimum + 1 },
        (_, offset) => ({ size, pieceCount: pieceCount.minimum + offset }),
      ),
    )
    .filter((condition) =>
      coversReflectionGenerationCondition(combination, condition),
    );
}
