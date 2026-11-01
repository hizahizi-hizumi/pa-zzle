import {
  type DifficultyAssessment,
  type DifficultyLevel,
  difficultyLevels,
  isInNumericRange,
  type NoAssessmentDetail,
  type NumericRange,
} from "@/games/difficulty";
import type {
  HamiltonianPathDifficultyAnalysis,
  HamiltonianPathReasoningFeatures,
} from "@/games/hamiltonian-path/problem/difficulty-analysis";
import {
  type HamiltonianPathBoardSize,
  type HamiltonianPathGenerationConditions,
  hamiltonianPathBoardSizes,
  hamiltonianPathTargetAssumptionCounts,
} from "@/games/hamiltonian-path/problem/problem";

export type HamiltonianPathDifficulty = DifficultyLevel;

/**
 * 1つのレベルが求める組み合わせ。
 * - `localReasoningSuffices`: 局所の推論（角・通路・袋小路、輪と端の連結の禁止）だけで道が決まるか。
 *   レベル1だけが真で、それより上は局所の推論で止まる地点を少なくとも1つ持つ。
 * - `assumptionCount`: 局所・分断・パリティの推論で止まり、数手先の破綻を読んで（1段仮置きで）道を決めた回数。
 *   レベルの挑戦の中身（先読みを重ねる回数）を決める。
 * - `boardSize`: 盤面の一辺。読む範囲となぞる長さで、単独でレベルを決めないよう隣のレベルと重なる範囲で許す。
 * - `minimumLongestRefutationLength`: 最も長い先読み（仮置きから矛盾が出るまでの推論の手数）の下限。省略したレベルでは問わない。
 *   解法器は先読みの手数の上限を3手・8手・20手・60手と広げながら仮置きを試すので、9以上は「どの辺を仮定しても
 *   8手以内には破綻が見えない局面が少なくとも1回あった」ことを表す。
 */
export type HamiltonianPathLevelCombination = {
  localReasoningSuffices: boolean;
  assumptionCount: NumericRange;
  boardSize: NumericRange<HamiltonianPathBoardSize>;
  minimumLongestRefutationLength?: number;
};

/**
 * 各レベルの組み合わせ。先読みの回数を1段ずつ上げ、盤面サイズの範囲は両端とも下げない。
 * 隣のレベルとは盤面サイズの範囲が重なり、重なった盤面では先読みの回数でレベルが分かれる。
 * レベル5だけは長い先読みも求め、短い先読みを何度も繰り返すだけで決まる問題と分ける。
 * 境界は人間の実プレイで確かめる前の暫定値。
 */
export const hamiltonianPathLevelCombinations = {
  "1": {
    localReasoningSuffices: true,
    assumptionCount: { minimum: 0, maximum: 0 },
    boardSize: { minimum: 5, maximum: 6 },
  },
  "2": {
    localReasoningSuffices: false,
    assumptionCount: { minimum: 0, maximum: 1 },
    boardSize: { minimum: 6, maximum: 7 },
  },
  "3": {
    localReasoningSuffices: false,
    assumptionCount: { minimum: 2, maximum: 3 },
    boardSize: { minimum: 7, maximum: 8 },
  },
  "4": {
    localReasoningSuffices: false,
    assumptionCount: { minimum: 4, maximum: 6 },
    boardSize: { minimum: 7, maximum: 8 },
  },
  "5": {
    localReasoningSuffices: false,
    assumptionCount: { minimum: 7, maximum: Number.POSITIVE_INFINITY },
    boardSize: { minimum: 8, maximum: 8 },
    minimumLongestRefutationLength: 9,
  },
} as const satisfies Record<
  HamiltonianPathDifficulty,
  HamiltonianPathLevelCombination
>;

type HamiltonianPathAssessedReasoning = Pick<
  HamiltonianPathReasoningFeatures,
  "assumptionCount" | "longestRefutationLength"
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
export type HamiltonianPathDifficultyAssessment = DifficultyAssessment<{
  classified: { reasoning: HamiltonianPathAssessedReasoning };
  outOfRange:
    | { reason: "too-light" | "too-heavy" }
    | {
        reason: "unlisted-combination";
        reasoning: HamiltonianPathAssessedReasoning;
      };
  unsupported: NoAssessmentDetail;
  invalid: NoAssessmentDetail;
}>;

function matchesLevelCombination(
  reasoning: HamiltonianPathReasoningFeatures,
  size: number,
  combination: HamiltonianPathLevelCombination,
): boolean {
  return (
    combination.localReasoningSuffices === reasoning.localReasoningSuffices &&
    isInNumericRange(reasoning.assumptionCount, combination.assumptionCount) &&
    isInNumericRange(size, combination.boardSize) &&
    reasoning.longestRefutationLength >=
      (combination.minimumLongestRefutationLength ?? 0)
  );
}

export function assessHamiltonianPathDifficulty(
  analysis: HamiltonianPathDifficultyAnalysis,
): HamiltonianPathDifficultyAssessment {
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
      };
      const difficulty = difficultyLevels.find(({ id }) =>
        matchesLevelCombination(
          reasoning,
          scale.size,
          hamiltonianPathLevelCombinations[id],
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
 * レベルの盤面サイズの範囲に入る生成条件（盤面サイズと仮置きの回数の目標の組）をすべて挙げる。問題の候補を作る範囲に使う。
 * 仮置きの回数の目標はレベルの判定条件ではなく、候補の分布を寄せる生成条件なので、どのレベルにも全ての値を挙げる。
 */
export function listHamiltonianPathGenerationConditions(
  difficulty: HamiltonianPathDifficulty,
): HamiltonianPathGenerationConditions[] {
  const { boardSize } = hamiltonianPathLevelCombinations[difficulty];
  return hamiltonianPathBoardSizes
    .filter((size) => isInNumericRange(size, boardSize))
    .flatMap((size) =>
      hamiltonianPathTargetAssumptionCounts.map((targetAssumptionCount) => ({
        size,
        targetAssumptionCount,
      })),
    );
}
