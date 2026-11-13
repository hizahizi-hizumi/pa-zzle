import {
  getNanpureUnitCellIndices,
  type NanpureUnit,
} from "@/games/nanpure/puzzle/rules";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";

/** 完成したまとまりを光らせる知らせ。`id` が変わるたびに光らせ直す。 */
export type NanpureUnitCompletionFlash = {
  id: number;
  units: readonly NanpureUnit[];
};

const UNIT_FLASH_STAGGER_MS = 30;
const UNIT_FLASH_DURATION_MS = 420;

const flashKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.9, offset: 0.3 },
  { opacity: 0 },
];

const digitKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.22)", offset: 0.3 },
  { transform: "scale(1)" },
];

/**
 * まとまりの端から何番目に光らせるか。行と列のように2つのまとまりが同じマスを含むときは、早い方の順番で光らせる。
 */
function getUnitFlashOrders(
  units: readonly NanpureUnit[],
): Map<number, number> {
  const orders = new Map<number, number>();
  for (const unit of units) {
    getNanpureUnitCellIndices(unit).forEach((cellIndex, order) => {
      orders.set(cellIndex, Math.min(orders.get(cellIndex) ?? order, order));
    });
  }
  return orders;
}

/** 完成したまとまりの9マスを、端から順に光らせて数字を弾ませる。 */
export function playUnitCompletionFlash(
  board: HTMLElement,
  units: readonly NanpureUnit[],
): Animation[] {
  if (prefersReducedMotion()) {
    return [];
  }

  return [...getUnitFlashOrders(units)].flatMap(([cellIndex, order]) => {
    const timing: KeyframeAnimationOptions = {
      duration: UNIT_FLASH_DURATION_MS,
      delay: order * UNIT_FLASH_STAGGER_MS,
      easing: MOTION_EASING.celebrate,
    };
    const flash = board.querySelector<HTMLElement>(
      `[data-nanpure-unit-flash="${cellIndex}"]`,
    );
    const digit = board.querySelector<HTMLElement>(
      `[data-nanpure-wave-cell="${cellIndex}"]`,
    );
    return [
      flash?.animate?.(flashKeyframes, timing),
      digit?.animate?.(digitKeyframes, timing),
    ].filter((animation) => animation !== undefined);
  });
}

export const _private = { getUnitFlashOrders };
