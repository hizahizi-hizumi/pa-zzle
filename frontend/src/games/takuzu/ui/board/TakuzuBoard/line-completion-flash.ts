import {
  getTakuzuLineCellIndices,
  type TakuzuLine,
} from "@/games/takuzu/puzzle/board";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

const LINE_FLASH_STAGGER_MS = 35;
const LINE_FLASH_DURATION_MS = 380;

const flashKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.85, offset: 0.3 },
  { opacity: 0 },
];

/** 行は左から、列は上から何番目に光らせるか。行と列が同じマスを含むときは、早い方の順番で光らせる。 */
function getLineFlashOrders(
  size: number,
  lines: readonly TakuzuLine[],
): Map<number, number> {
  const orders = new Map<number, number>();
  for (const line of lines) {
    getTakuzuLineCellIndices(size, line).forEach((cellIndex, order) => {
      orders.set(cellIndex, Math.min(orders.get(cellIndex) ?? order, order));
    });
  }
  return orders;
}

/** 違反なく埋まった行・列のマスを、端から順に軽く光らせる。 */
export function playLineCompletionFlash(
  board: HTMLElement,
  size: number,
  lines: readonly TakuzuLine[],
): Animation[] {
  if (prefersReducedMotion()) {
    return [];
  }

  return [...getLineFlashOrders(size, lines)].flatMap(
    ([cellIndex, order]) =>
      board
        .querySelector<HTMLElement>(`[data-takuzu-line-flash="${cellIndex}"]`)
        ?.animate?.(flashKeyframes, {
          duration: LINE_FLASH_DURATION_MS,
          delay: order * LINE_FLASH_STAGGER_MS,
          easing: MOTION_EASING.celebrate,
        }) ?? [],
  );
}

export const _private = { getLineFlashOrders };
