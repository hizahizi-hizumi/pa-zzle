import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";
import {
  TSUME_SHOGI_DEEP_DECOY_MINIMUM_REMAINING_PLIES,
  type TsumeShogiDifficultyAnalysis,
  type TsumeShogiDifficultyFeatures,
} from "@/games/tsume-shogi/problem/difficulty-analysis";
import {
  copyTsumeShogiGenerationConditions,
  type TsumeShogiGenerationConditions,
  type TsumeShogiGenerationPlies,
  type TsumeShogiRootCheckRange,
} from "@/games/tsume-shogi/problem/problem";

export type TsumeShogiDifficulty = DifficultyLevel;

/**
 * 生成条件で初手の王手の数を上に絞らないときの上端。生成条件は identity と seed に残るので、無限大ではなく整数で表す。
 * 初手の王手の数がこれを超える問題は生成でも現れない。
 */
const UNBOUNDED_GENERATION_ROOT_CHECKS = 99;

/** 値は `analyzeTsumeShogiDifficulty` の特徴。 */
export type TsumeShogiLevelCombination = {
  rootChecks: NumericRange;
  /** もっともらしい誤王手は深い紛れを含むので、深い紛れの下限より小さくはならない。 */
  plausibleWrong: NumericRange;
  deepDecoyCount: NumericRange;
  lineComparison?: {
    minimumTesujiKindCount: number;
    minimumDefenseBranching: number;
  };
  /** 問題の候補を作るときに初手の王手の数を絞る範囲（生成条件）。分類には使わない。 */
  generationRootChecks: TsumeShogiRootCheckRange;
};

/**
 * 手数は条件にしない（深い紛れは残りの手数が5以上の判断地点でだけ起きるので、結果としてレベル3以上は5手詰になる）。
 * 境界は人間の実プレイで確かめる前の暫定値。
 */
export const tsumeShogiLevelCombinations = {
  "1": {
    rootChecks: { minimum: 1, maximum: 4 },
    plausibleWrong: { minimum: 0, maximum: 0 },
    deepDecoyCount: { minimum: 0, maximum: 0 },
    generationRootChecks: { minimum: 1, maximum: 4 },
  },
  "2": {
    rootChecks: { minimum: 1, maximum: 10 },
    plausibleWrong: { minimum: 0, maximum: 5 },
    deepDecoyCount: { minimum: 0, maximum: 0 },
    generationRootChecks: { minimum: 2, maximum: 10 },
  },
  "3": {
    rootChecks: { minimum: 1, maximum: Number.POSITIVE_INFINITY },
    plausibleWrong: { minimum: 1, maximum: Number.POSITIVE_INFINITY },
    deepDecoyCount: { minimum: 1, maximum: 2 },
    generationRootChecks: { minimum: 3, maximum: 12 },
  },
  "4": {
    rootChecks: { minimum: 1, maximum: Number.POSITIVE_INFINITY },
    plausibleWrong: { minimum: 3, maximum: Number.POSITIVE_INFINITY },
    deepDecoyCount: { minimum: 3, maximum: 5 },
    lineComparison: { minimumTesujiKindCount: 2, minimumDefenseBranching: 2 },
    generationRootChecks: {
      minimum: 6,
      maximum: UNBOUNDED_GENERATION_ROOT_CHECKS,
    },
  },
  "5": {
    rootChecks: { minimum: 1, maximum: Number.POSITIVE_INFINITY },
    plausibleWrong: { minimum: 6, maximum: Number.POSITIVE_INFINITY },
    deepDecoyCount: { minimum: 6, maximum: Number.POSITIVE_INFINITY },
    lineComparison: { minimumTesujiKindCount: 2, minimumDefenseBranching: 2 },
    generationRootChecks: {
      minimum: 10,
      maximum: UNBOUNDED_GENERATION_ROOT_CHECKS,
    },
  },
} as const satisfies Record<TsumeShogiDifficulty, TsumeShogiLevelCombination>;

export type TsumeShogiDifficultyAssessment = DifficultyAssessment<{
  classified: { deepDecoyCount: number };
  outOfRange: { reason: "mate-in-one" | "unlisted-combination" };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

function hasLineComparison(
  features: TsumeShogiDifficultyFeatures,
  lineComparison: TsumeShogiLevelCombination["lineComparison"],
): boolean {
  return (
    lineComparison === undefined ||
    features.tesujiKindCount >= lineComparison.minimumTesujiKindCount ||
    features.defenseBranching >= lineComparison.minimumDefenseBranching
  );
}

function matchesLevelCombination(
  features: TsumeShogiDifficultyFeatures,
  combination: TsumeShogiLevelCombination,
): boolean {
  return (
    isInNumericRange(features.rootChecks, combination.rootChecks) &&
    isInNumericRange(features.plausibleWrong, combination.plausibleWrong) &&
    isInNumericRange(features.deepDecoyCount, combination.deepDecoyCount) &&
    hasLineComparison(features, combination.lineComparison)
  );
}

export function assessTsumeShogiDifficulty(
  analysis: TsumeShogiDifficultyAnalysis,
): TsumeShogiDifficultyAssessment {
  switch (analysis.status) {
    case "invalid":
      return { status: "invalid" };
    case "unsupported":
      return { status: "unsupported" };
    case "analyzed": {
      if (analysis.plies === 1) {
        return { status: "out-of-range", reason: "mate-in-one" };
      }
      const { features } = analysis;
      const difficulty = difficultyLevels.find(({ id }) =>
        matchesLevelCombination(features, tsumeShogiLevelCombinations[id]),
      )?.id;
      return difficulty
        ? {
            status: "classified",
            difficulty,
            deepDecoyCount: features.deepDecoyCount,
          }
        : { status: "out-of-range", reason: "unlisted-combination" };
    }
  }
}

const levelGenerationPlies = [3, 5] as const satisfies readonly Exclude<
  TsumeShogiGenerationPlies,
  1
>[];

/**
 * レベルの候補を足すために、逆算の起点を絞った生成条件。この条件の候補は、条件を挙げたレベルにだけ採る。
 * レベル1 は起点の1手詰の多くが駒打ちで、最終手が駒打ちの問題に偏るので、盤上の駒を動かして詰める1手詰を起点にした
 * 3手詰を足す（同じ起点の5手詰は、レベル1 に分類される候補が少ない）。
 */
const supplementalGenerationConditions: Partial<
  Record<TsumeShogiDifficulty, readonly TsumeShogiGenerationConditions[]>
> = {
  "1": [
    {
      plies: 3,
      rootChecks: tsumeShogiLevelCombinations["1"].generationRootChecks,
      baseMate: "board-move",
    },
  ],
};

export function listTsumeShogiGenerationConditions(
  difficulty: TsumeShogiDifficulty,
): TsumeShogiGenerationConditions[] {
  const { deepDecoyCount, generationRootChecks } =
    tsumeShogiLevelCombinations[difficulty];
  const conditions: TsumeShogiGenerationConditions[] = [
    ...levelGenerationPlies
      .filter(
        (plies) =>
          deepDecoyCount.minimum === 0 ||
          plies >= TSUME_SHOGI_DEEP_DECOY_MINIMUM_REMAINING_PLIES,
      )
      .map((plies) => ({ plies, rootChecks: { ...generationRootChecks } })),
    ...(supplementalGenerationConditions[difficulty] ?? []).map(
      copyTsumeShogiGenerationConditions,
    ),
  ];
  // どの条件も、起点の玉を盤の上の端に置くものと盤の中ほどに置くもの（`baseKingArea: "middle"`）の両方を挙げる。
  // 上の端の詰み上がりから逆算した候補だけでは、玉から見た攻方の手順が同じ問題が多く、レベルの中で手順の重ならない問題が
  // 足りないため。
  return [
    ...conditions,
    ...conditions.map((condition) => ({
      ...copyTsumeShogiGenerationConditions(condition),
      baseKingArea: "middle" as const,
    })),
  ];
}

export function isTsumeShogiSupplementalGenerationConditions(
  conditions: TsumeShogiGenerationConditions,
): boolean {
  return conditions.baseMate !== undefined;
}
