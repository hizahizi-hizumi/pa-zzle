import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import type { BottleRect } from "@/games/water-sort/ui/board/pour/pour-path";
import {
  TUBE_INNER,
  TUBE_SLOT_HEIGHT,
  TUBE_VIEW_HEIGHT,
  TUBE_VIEW_WIDTH,
} from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

/** 口の縁を離れた液が、注ぐ向きへ少し飛び出してから落ちる量（注ぎ先の幅に対する割合）。 */
const STREAM_THROW_RATIO = 0.03;

/** 注ぎ先の、液の入る箱（viewport の px）。段は下から数える。 */
export type LiquidBox = {
  left: number;
  width: number;
  bottom: number;
  slotHeight: number;
};

export function getLiquidBox(rect: BottleRect): LiquidBox {
  return {
    left: rect.left + (rect.width * TUBE_INNER.left) / TUBE_VIEW_WIDTH,
    width:
      (rect.width * (TUBE_INNER.right - TUBE_INNER.left)) / TUBE_VIEW_WIDTH,
    bottom: rect.top + (rect.height * TUBE_INNER.bottom) / TUBE_VIEW_HEIGHT,
    slotHeight: (rect.height * TUBE_SLOT_HEIGHT) / TUBE_VIEW_HEIGHT,
  };
}

/** 流れが落ちる横の位置（viewport の px）。 */
export function getStreamX(animation: PourAnimation): number {
  const { path, destination } = animation;
  return (
    path.lip.x + path.direction * destination.rect.width * STREAM_THROW_RATIO
  );
}

/** 液の入る箱の中での、流れの横の位置（箱の幅に対する割合、0〜1）。 */
export function getStreamRatioInBox(animation: PourAnimation): number {
  const box = getLiquidBox(animation.destination.rect);
  return (getStreamX(animation) - box.left) / box.width;
}
