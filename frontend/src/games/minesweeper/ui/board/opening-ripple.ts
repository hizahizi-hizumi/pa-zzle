import { prefersReducedMotion } from "@/lib/motion";

/** 押したマスから1マス離れるごとに開く動きを遅らせる長さ。遠くまで連鎖したときは、全体が上限に収まるよう縮める。 */
const OPENING_RIPPLE_STEP_MS = 14;
const OPENING_RIPPLE_MAX_SPREAD_MS = 200;
const OPENING_CELL_DURATION_MS = 160;
const OPENING_CELL_EASING = "ease-out";

/** 開いたマスが、閉じた面の下から沈んだ面として現れる。遅れて開くマスは、開くまで面を見せない。 */
const openingKeyframes: Keyframe[] = [
  { transform: "scale(0.55)", opacity: 0 },
  { transform: "scale(1.06)", opacity: 1, offset: 0.55 },
  { transform: "scale(1)", opacity: 1 },
];

export type OpeningRipple = {
  delayByCellIndex: ReadonlyMap<number, number>;
  /** 最後のマスが開き始めるまでの長さ。 */
  spreadMs: number;
};

function getRingDistance(
  columns: number,
  fromCellIndex: number,
  toCellIndex: number,
): number {
  return Math.max(
    Math.abs(
      Math.floor(fromCellIndex / columns) - Math.floor(toCellIndex / columns),
    ),
    Math.abs((fromCellIndex % columns) - (toCellIndex % columns)),
  );
}

/** 押したマスから周りへ1周ずつ広がる順に、開いたマスを開き始める時刻。 */
export function getOpeningRipple(
  columns: number,
  originCellIndex: number,
  openedCellIndices: readonly number[],
): OpeningRipple {
  const distances = openedCellIndices.map((cellIndex) =>
    getRingDistance(columns, originCellIndex, cellIndex),
  );
  const farthest = Math.max(0, ...distances);
  const step =
    farthest === 0
      ? 0
      : Math.min(
          OPENING_RIPPLE_STEP_MS,
          OPENING_RIPPLE_MAX_SPREAD_MS / farthest,
        );
  return {
    delayByCellIndex: new Map(
      openedCellIndices.map((cellIndex, index) => [
        cellIndex,
        Math.round((distances[index] ?? 0) * step),
      ]),
    ),
    spreadMs: Math.round(farthest * step),
  };
}

export function playOpeningRipple(
  board: HTMLElement,
  { delayByCellIndex }: OpeningRipple,
): Animation[] {
  if (prefersReducedMotion()) {
    return [];
  }
  return [...delayByCellIndex].flatMap(
    ([cellIndex, delay]) =>
      board
        .querySelector<HTMLElement>(`[data-cell-index="${cellIndex}"]`)
        ?.animate?.(openingKeyframes, {
          duration: OPENING_CELL_DURATION_MS,
          delay,
          easing: OPENING_CELL_EASING,
          fill: "backwards",
        }) ?? [],
  );
}
