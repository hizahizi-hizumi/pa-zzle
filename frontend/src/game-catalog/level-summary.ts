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

/**
 * 主な一言でレベルを言い分け、主な一言がほかのレベルと同じになるレベルにだけ、違いを表す一言を `・` でつないで添える。
 */
export function summarizeLevelsDistinctly(
  summarize: (difficulty: DifficultyLevel) => string,
  distinguish: (difficulty: DifficultyLevel) => string,
): LevelSummaries {
  const summaries = summarizeLevels(summarize);
  const counts = new Map<string, number>();
  for (const summary of Object.values(summaries)) {
    counts.set(summary, (counts.get(summary) ?? 0) + 1);
  }
  return summarizeLevels((difficulty) => {
    const summary = summaries[difficulty];
    return (counts.get(summary) ?? 0) > 1
      ? `${summary}・${distinguish(difficulty)}`
      : summary;
  });
}

/** 数の集まりを、最小から最大までの範囲にする。 */
export function toNumericRange(values: readonly number[]): NumericRange {
  return { minimum: Math.min(...values), maximum: Math.max(...values) };
}

/** 範囲の集まりを、すべてを含む1つの範囲にする。 */
export function mergeRanges(ranges: readonly NumericRange[]): NumericRange {
  return {
    minimum: Math.min(...ranges.map(({ minimum }) => minimum)),
    maximum: Math.max(...ranges.map(({ maximum }) => maximum)),
  };
}

/** 範囲の両端を「〜」でつなぐ。両端が同じなら1つの値に、上の端が無ければ「以上」にする。 */
export function formatRange(
  { minimum, maximum }: NumericRange,
  unit = "",
): string {
  if (maximum === Number.POSITIVE_INFINITY) {
    return `${minimum}${unit}以上`;
  }
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
