import {
  type DifficultyLevel,
  difficultyLevels,
  type NumericRange,
} from "@/games/difficulty";

/** レベルのカードに添える、そのレベルの中身を一言で表したもの。 */
export type LevelSummaries = Readonly<Record<DifficultyLevel, string>>;

export function summarizeLevels(
  summarize: (difficulty: DifficultyLevel) => string,
): LevelSummaries {
  return Object.fromEntries(
    difficultyLevels.map(({ id }) => [id, summarize(id)]),
  ) as Record<DifficultyLevel, string>;
}

/** 範囲の両端を「〜」でつなぐ。両端が同じなら1つの値にする。 */
export function formatRange(
  { minimum, maximum }: NumericRange,
  unit = "",
): string {
  return minimum === maximum
    ? `${minimum}${unit}`
    : `${minimum}〜${maximum}${unit}`;
}

/** 正方形の盤の一辺の範囲。1つの大きさなら「5×5」、幅があれば「一辺5〜6」。 */
export function formatSquareBoardRange(range: NumericRange): string {
  return range.minimum === range.maximum
    ? `${range.minimum}×${range.minimum}`
    : `一辺${formatRange(range)}`;
}
