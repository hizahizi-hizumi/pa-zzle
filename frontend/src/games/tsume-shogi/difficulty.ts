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

export const tsumeShogiDifficulties = [
  { id: "1", label: "レベル 1" },
  { id: "2", label: "レベル 2" },
  { id: "3", label: "レベル 3" },
  { id: "4", label: "レベル 4" },
  { id: "5", label: "レベル 5" },
] as const;

export type TsumeShogiDifficulty =
  (typeof tsumeShogiDifficulties)[number]["id"];

export function parseTsumeShogiDifficulty(
  value: string | undefined,
): TsumeShogiDifficulty | undefined {
  return tsumeShogiDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getTsumeShogiDifficultyLabel(
  difficulty: TsumeShogiDifficulty,
): string {
  return (
    tsumeShogiDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}

/** 両端を含む範囲。 */
type InclusiveRange = { minimum: number; maximum: number };

/** 上限を置かない範囲の上端。初手の王手・誤王手の数がこれを超える問題は生成でも現れない大きさにしてある。 */
const UNBOUNDED = 99;

/**
 * 1つのレベルが求める組み合わせ。値は `analyzeTsumeShogiDifficulty` の特徴。
 * - `rootChecks`: 初手の合法な王手の数。読み始めの候補の広さ。
 * - `plausibleWrong`: もっともらしい誤王手（すぐには崩れない誤王手）の数。深い紛れを含むので、深い紛れの下限より小さくはならない。
 * - `deepDecoyCount`: 深い紛れ（反証が4手目以降まで見えない誤王手）の数。レベルの挑戦の中心。
 * - `lineComparison`: 正しい手順の側の比べどころ。作意の手筋の種類が `minimumTesujiKindCount` 以上か、作意以外の自然な応手
 *   （変化）が `minimumDefenseBranching` 以上あること。省略したレベルでは問わない。
 * - `generationRootChecks`: 問題の候補を作るときに初手の王手の数を絞る範囲（生成条件）。分類には使わない。
 */
export type TsumeShogiLevelCombination = {
  rootChecks: InclusiveRange;
  plausibleWrong: InclusiveRange;
  deepDecoyCount: InclusiveRange;
  lineComparison?: {
    minimumTesujiKindCount: number;
    minimumDefenseBranching: number;
  };
  generationRootChecks: TsumeShogiRootCheckRange;
};

/**
 * 各レベルの組み合わせ。上のレベルほど下のレベルの挑戦（もっともらしい誤王手の反証）を含み、深い紛れの本数を増やす。
 * レベル1・2 は深い紛れを持たず、レベル1 はもっともらしい誤王手も持たない。レベル4・5 は正しい手順の側にも手筋の組み合わせか
 * 変化の比べどころを求める。分類はレベル1から順に最初に当たったレベルにする。手数は条件にしない（深い紛れは残りの手数が
 * 5以上の判断地点でだけ起きるので、結果としてレベル3以上は5手詰になる）。
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
    rootChecks: { minimum: 1, maximum: UNBOUNDED },
    plausibleWrong: { minimum: 1, maximum: UNBOUNDED },
    deepDecoyCount: { minimum: 1, maximum: 2 },
    generationRootChecks: { minimum: 3, maximum: 12 },
  },
  "4": {
    rootChecks: { minimum: 1, maximum: UNBOUNDED },
    plausibleWrong: { minimum: 3, maximum: UNBOUNDED },
    deepDecoyCount: { minimum: 3, maximum: 5 },
    lineComparison: { minimumTesujiKindCount: 2, minimumDefenseBranching: 2 },
    generationRootChecks: { minimum: 6, maximum: UNBOUNDED },
  },
  "5": {
    rootChecks: { minimum: 1, maximum: UNBOUNDED },
    plausibleWrong: { minimum: 6, maximum: UNBOUNDED },
    deepDecoyCount: { minimum: 6, maximum: UNBOUNDED },
    lineComparison: { minimumTesujiKindCount: 2, minimumDefenseBranching: 2 },
    generationRootChecks: { minimum: 10, maximum: UNBOUNDED },
  },
} as const satisfies Record<TsumeShogiDifficulty, TsumeShogiLevelCombination>;

/**
 * 分析結果を難易度へ分類した結果。
 * - `classified`: 提供範囲内で、組み合わせがいずれかのレベルに当たった。
 * - `out-of-range`: 評価できるが提供しない。`mate-in-one` は1手詰（通常の難易度の手数として扱わない）、
 *   `unlisted-combination` は組み合わせがどのレベルにも当たらない。
 * - `unsupported`: 問題としては成り立ちうるが、挑戦の強さを評価できない（supported subset の外、分析できる手数を超える）。
 * - `invalid`: 指定の手数の完全作として成り立たない。
 */
export type TsumeShogiDifficultyAssessment =
  | {
      status: "classified";
      difficulty: TsumeShogiDifficulty;
      deepDecoyCount: number;
    }
  | {
      status: "out-of-range";
      reason: "mate-in-one" | "unlisted-combination";
    }
  | { status: "unsupported" }
  | { status: "invalid" };

function isInRange(value: number, { minimum, maximum }: InclusiveRange) {
  return minimum <= value && value <= maximum;
}

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
    isInRange(features.rootChecks, combination.rootChecks) &&
    isInRange(features.plausibleWrong, combination.plausibleWrong) &&
    isInRange(features.deepDecoyCount, combination.deepDecoyCount) &&
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
      const difficulty = tsumeShogiDifficulties.find(({ id }) =>
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

/** 通常の難易度で扱う手数。1手詰は通常の難易度の手数として扱わない。 */
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

/**
 * レベルの問題の候補を作る生成条件（手数と初手の王手の数の範囲、起点を絞るなら起点の種類）をすべて挙げる。深い紛れを
 * 求めるレベルは、深い紛れが起きうる手数（残りの手数が5以上の判断地点を持つ手数）だけにする。
 * どの条件も、起点の玉を盤の上の端に置くものと盤の中ほどに置くもの（`baseKingArea: "middle"`）の両方を挙げる。
 * 上の端の詰み上がりから逆算した候補だけでは、玉から見た攻方の手順が同じ問題が多く、レベルの中で手順の重ならない問題が
 * 足りないため。
 */
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
  return [
    ...conditions,
    ...conditions.map((condition) => ({
      ...copyTsumeShogiGenerationConditions(condition),
      baseKingArea: "middle" as const,
    })),
  ];
}

/** 逆算の起点を絞った生成条件か。この条件の候補は、条件を挙げたレベルにだけ採る。 */
export function isTsumeShogiSupplementalGenerationConditions(
  conditions: TsumeShogiGenerationConditions,
): boolean {
  return conditions.baseMate !== undefined;
}
