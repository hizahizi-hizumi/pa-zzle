/** 全ゲームが提供する5段階の難易度レベル。 */
export const difficultyLevels = [
  { id: "1", label: "レベル 1" },
  { id: "2", label: "レベル 2" },
  { id: "3", label: "レベル 3" },
  { id: "4", label: "レベル 4" },
  { id: "5", label: "レベル 5" },
] as const;

export type DifficultyLevel = (typeof difficultyLevels)[number]["id"];

// 5段階になる前の3段階の区分。その時代の記録を、旧区分のまま読み込み表示するためだけに残す。
const legacyDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type LegacyDifficulty = (typeof legacyDifficulties)[number]["id"];

/** 記録に残っている難易度。3段階の時代があったゲームの記録は、旧区分も持つ。 */
export type RecordedDifficulty = DifficultyLevel | LegacyDifficulty;

export function parseDifficultyLevel(
  value: string | undefined,
): DifficultyLevel | undefined {
  return difficultyLevels.find((level) => level.id === value)?.id;
}

export function parseLegacyDifficulty(
  value: string | undefined,
): LegacyDifficulty | undefined {
  return legacyDifficulties.find((difficulty) => difficulty.id === value)?.id;
}

export function parseRecordedDifficulty(
  value: string | undefined,
): RecordedDifficulty | undefined {
  return parseDifficultyLevel(value) ?? parseLegacyDifficulty(value);
}

export function getDifficultyLabel(difficulty: RecordedDifficulty): string {
  return (
    [...difficultyLevels, ...legacyDifficulties].find(
      (option) => option.id === difficulty,
    )?.label ?? difficulty
  );
}

/**
 * 難易度の基準に使う数値の範囲。両端を含む。
 * `excludesMinimum` のときは下限ちょうどの値を含まず、その値は下のレベルの上限に属する。
 * 片側に限りが無い範囲は、その端を無限大で表す。
 */
export type NumericRange<T extends number = number> = {
  minimum: T;
  maximum: T;
  excludesMinimum?: true;
};

export function isInNumericRange(
  value: number,
  { minimum, maximum, excludesMinimum }: NumericRange,
): boolean {
  return (
    (excludesMinimum ? minimum < value : minimum <= value) && value <= maximum
  );
}

/** 判定結果の状態に、状態名のほかに添える値が無いこと。 */
export type NoAssessmentDetail = Record<never, never>;

/**
 * 各状態に添える値。そのゲームで起こらない状態は `never` にする。
 * - `classified`: 分類できたときに、レベルのほかに添える値。
 * - `outOfRange`: 提供しない理由（`reason`）と、それに添える値。
 * - `unsupported`: 評価できなかったときに添える値。
 * - `invalid`: 問題として成立しないときに添える値。
 */
type DifficultyAssessmentDetails = {
  classified: object;
  outOfRange: { reason: string };
  unsupported: object;
  invalid: object;
};

/**
 * 問題を難易度へ分類した結果。全ゲームの分類関数がこの形で返す。
 * - `classified`: 提供範囲内で、難易度が決まった。
 * - `out-of-range`: 評価できるが、どのレベルにも当たらないので提供しない。
 * - `unsupported`: 問題としては成立するが、挑戦の強さを評価できない。
 * - `invalid`: 問題として成立しない。
 */
export type DifficultyAssessment<T extends DifficultyAssessmentDetails> =
  | ({ status: "classified"; difficulty: DifficultyLevel } & T["classified"])
  | ({ status: "out-of-range" } & T["outOfRange"])
  | ({ status: "unsupported" } & T["unsupported"])
  | ({ status: "invalid" } & T["invalid"]);
