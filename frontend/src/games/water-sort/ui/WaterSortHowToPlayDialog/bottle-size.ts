/** ボトルの間を本番の比にしたときの幅。 */
const figureGap =
  "calc(var(--water-sort-figure-bottle) * var(--water-sort-figure-gap-ratio, 0.24))";

/**
 * ボトルを1段に並べたときの、ボトルの間。本番の比にし、ボトルの幅を変えずに置き場所に収まらない狭い画面（幅 320px など）でだけ、
 * 収まるところまで詰める。置き場所の幅は、一番近いコンテナの幅（例の面の内側か、ゴールの盤面の置き場所）にする。
 */
export function getBottleRowGap(bottleCount: number): string {
  if (bottleCount <= 1) {
    return "0px";
  }
  return `max(0px, min(${figureGap}, calc((100cqw - var(--water-sort-figure-bottle) * ${bottleCount}) / ${bottleCount - 1})))`;
}

/** ボトルを1段に並べたときの幅。 */
export function getBottleRowWidth(bottleCount: number): string {
  return `calc(var(--water-sort-figure-bottle) * ${bottleCount} + ${getBottleRowGap(bottleCount)} * ${Math.max(0, bottleCount - 1)})`;
}

/** 間を本番の比にしたとき、`bottleCount` 本を1段に並べた幅が、ボトルの幅の何倍か。ゴールの盤面の大きさを置き場所の幅から決めるときに使う。 */
export function getBottleRowWidthRatio(bottleCount: number): string {
  return `(${bottleCount} + var(--water-sort-figure-gap-ratio, 0.24) * ${Math.max(0, bottleCount - 1)})`;
}
