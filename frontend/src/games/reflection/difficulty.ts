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

type ReflectionReasoningLevel = ReflectionReasoningFeatures["highestLevel"];

/** 両端を含む範囲。 */
type InclusiveRange<T extends number> = { minimum: T; maximum: T };

/**
 * 1つのレベルが求める組み合わせ。
 * - `reasoningLevel`: 置き場所を決め切るのに要る最も深い推論レベル。レベルの挑戦の中身を決める。
 * - `boardSize` / `pieceCount`: 読む範囲（外周ヒント 4n 本と光路の長さ）と置く対象の数。単独でレベルを決めない。
 * - `piecesPerClue`: 外周ヒント1本あたりのピース数（ピース数 ÷ 4n）の範囲。同じピース数でも盤面が狭いほどヒント同士が
 *   同じピースを取り合い、1本あたりの手掛かりも減るので難しい。レベルの中でこれを揃え、盤面が広いほどピースを多くして、
 *   広い盤面が狭い盤面より易しくなる逆転を防ぐ。省略したレベルでは問わない。
 * - `minimumTrialRetryCount`: 一致表示を見ながら1本ずつ満たす試し置きで、少なくともこの回数は一致を崩したり
 *   置き方を変えたりしないと解けないこと（試し置きで解き切れない問題も満たす）。一致表示があっても、外周ヒント同士の
 *   干渉で試し置きだけでは押し切れない問題に限る。省略したレベルでは問わない。
 */
export type ReflectionLevelCombination = {
  reasoningLevel: ReflectionReasoningLevel;
  boardSize: InclusiveRange<ReflectionBoardSize>;
  pieceCount: InclusiveRange<number>;
  piecesPerClue?: InclusiveRange<number>;
  minimumTrialRetryCount?: number;
};

/**
 * 各レベルの組み合わせ。推論レベルを1段ずつ上げ、規模の範囲と試し置きのやり直しの下限は両端とも下げない。
 * 隣のレベルとは規模の範囲が重なり、重なった規模では推論レベルと試し置きのやり直しでレベルが分かれる。
 * レベル4・5 は、一致表示を見ながら1本ずつ満たす試し置きでは押し切れない（外周ヒント同士が干渉する）問題に限る。
 * レベル4・5 は外周ヒント1本あたりのピース数も揃える。密な盤面ではピースが他のピースの陰に隠れて問題成立条件を満たしにくく、
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

/** 生成条件（盤面サイズとピース数の組）が、レベルの規模の範囲に入るか。 */
export function coversReflectionGenerationCondition(
  { boardSize, pieceCount, piecesPerClue }: ReflectionLevelCombination,
  condition: { size: number; pieceCount: number },
): boolean {
  return (
    isInRange(condition.size, boardSize) &&
    isInRange(condition.pieceCount, pieceCount) &&
    (piecesPerClue === undefined ||
      isInRange(condition.pieceCount / (condition.size * 4), piecesPerClue))
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
      const difficulty = reflectionDifficulties.find(({ id }) =>
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

/** レベルの規模の範囲に入る生成条件（盤面サイズとピース数の組）をすべて挙げる。問題の候補を作る範囲に使う。 */
export function listReflectionGenerationConditions(
  difficulty: ReflectionDifficulty,
): ReflectionGenerationConditions[] {
  const combination = reflectionLevelCombinations[difficulty];
  const { boardSize, pieceCount } = combination;
  return reflectionBoardSizes
    .filter((size) => isInRange(size, boardSize))
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
