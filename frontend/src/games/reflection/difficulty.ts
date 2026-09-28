import type { ReflectionDifficultyAnalysis } from "@/games/reflection/problem/difficulty-analysis";
import type { ReflectionReasoningLevel } from "@/games/reflection/problem/generation/human-solver";
import {
  type ReflectionBoardSize,
  type ReflectionGenerationConditions,
  reflectionBoardSizes,
} from "@/games/reflection/problem/problem";

export const reflectionDifficulties = [
  { id: "1", label: "レベル 1" },
  { id: "2", label: "レベル 2" },
  { id: "3", label: "レベル 3" },
  { id: "4", label: "レベル 4" },
  { id: "5", label: "レベル 5" },
] as const;

export type ReflectionDifficulty =
  (typeof reflectionDifficulties)[number]["id"];

export function parseReflectionDifficulty(
  value: string | undefined,
): ReflectionDifficulty | undefined {
  return reflectionDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getReflectionDifficultyLabel(
  difficulty: ReflectionDifficulty,
): string {
  return (
    reflectionDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}

/** 両端を含む範囲。 */
type InclusiveRange<T extends number> = { minimum: T; maximum: T };

/**
 * 1つのレベルが求める組み合わせ。
 * - `reasoningLevel`: 置き場所を決め切るのに要る最も深い推論レベル。レベルの挑戦の中身を決める。
 * - `boardSize` / `pieceCount`: 読む範囲（外周ヒント 4n 本）と置く対象の数。単独でレベルを決めないよう、隣のレベルと重なる範囲で許す。
 */
export type ReflectionLevelCombination = {
  reasoningLevel: ReflectionReasoningLevel;
  boardSize: InclusiveRange<ReflectionBoardSize>;
  pieceCount: InclusiveRange<number>;
};

/**
 * 各レベルの組み合わせ。推論レベルを1段ずつ上げ、規模の範囲は両端とも下げない。隣のレベルとは規模の範囲が重なる。
 * 7×7・12ピースは分析時間の裾が長く（1問で80秒台）評価不能も出たため、ピース数の上限を11にしている。
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
    boardSize: { minimum: 5, maximum: 6 },
    pieceCount: { minimum: 4, maximum: 7 },
  },
  "4": {
    reasoningLevel: 4,
    boardSize: { minimum: 6, maximum: 7 },
    pieceCount: { minimum: 6, maximum: 10 },
  },
  "5": {
    reasoningLevel: 5,
    boardSize: { minimum: 6, maximum: 7 },
    pieceCount: { minimum: 8, maximum: 11 },
  },
} as const satisfies Record<ReflectionDifficulty, ReflectionLevelCombination>;

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、組み合わせがいずれかのレベルに当たった。
 * - `out-of-range`: 評価できるが、推論レベルと規模の組み合わせがどのレベルにも当たらないので提供しない。
 * - `unsupported`: 一意解だが、推論レベル5まで使っても置き場所が決まらず、挑戦の強さを評価できない。
 * - `invalid`: 解が無い、または2つ以上あり、問題として成立しない。
 */
export type ReflectionDifficultyAssessment =
  | {
      status: "classified";
      difficulty: ReflectionDifficulty;
      reasoningLevel: ReflectionReasoningLevel;
    }
  | {
      status: "out-of-range";
      reason: "unlisted-combination";
      reasoningLevel: ReflectionReasoningLevel;
    }
  | { status: "unsupported" }
  | { status: "invalid" };

function isInRange(
  value: number,
  { minimum, maximum }: InclusiveRange<number>,
) {
  return minimum <= value && value <= maximum;
}

function matchesLevelCombination(
  reasoningLevel: ReflectionReasoningLevel,
  size: number,
  pieceCount: number,
  combination: ReflectionLevelCombination,
): boolean {
  return (
    combination.reasoningLevel === reasoningLevel &&
    isInRange(size, combination.boardSize) &&
    isInRange(pieceCount, combination.pieceCount)
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
      const difficulty = reflectionDifficulties.find(({ id }) =>
        matchesLevelCombination(
          highestLevel,
          size,
          pieceCount,
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

/** レベルの規模の範囲に入る生成条件（盤面サイズとピース数の組）をすべて挙げる。問題の候補を作る範囲に使う。 */
export function listReflectionGenerationConditions(
  difficulty: ReflectionDifficulty,
): ReflectionGenerationConditions[] {
  const { boardSize, pieceCount } = reflectionLevelCombinations[difficulty];
  return reflectionBoardSizes
    .filter((size) => isInRange(size, boardSize))
    .flatMap((size) =>
      Array.from(
        { length: pieceCount.maximum - pieceCount.minimum + 1 },
        (_, offset) => ({ size, pieceCount: pieceCount.minimum + offset }),
      ),
    );
}
