import type {
  BottleRect,
  PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

export const POUR_TRANSFER_START_OFFSET = 0.38;
export const POUR_TRANSFER_END_OFFSET = 0.72;
export const POUR_TILT_EASING = "cubic-bezier(.22,.61,.36,1)";

/**
 * 注ぐ演出の層の重なり順。プレイ画面の中で、盤面と操作部品より上に、注ぎ先・水の筋・注ぎ元の順で重ねる。
 * 値はプレイ画面の重なりの中だけで使う。
 */
export const POUR_LAYER_ORDER = {
  destination: 1,
  stream: 2,
  source: 3,
} as const;

export function getOverlayStyle(rect: BottleRect, zIndex: number) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex,
  };
}

/** `WaterBottle` の水の入る範囲は、ボトルの上端から 12px 下と、下端から 4px 上の間。 */
const WATER_TOP_INSET_PX = 12;
const WATER_BOTTOM_INSET_PX = 4;
const BOTTLE_CAPACITY = 4;

/** 水の筋は、注ぎ元の口から、注ぎ先の注ぐ前の水面まで流す。 */
export function getPourStreamStyle(animation: PourAnimation) {
  const { rect: destinationRect, before } = animation.destination;
  const streamTop = animation.pose.mouthY;
  const waterHeight =
    destinationRect.height - WATER_TOP_INSET_PX - WATER_BOTTOM_INSET_PX;
  const surfaceY =
    destinationRect.top +
    WATER_TOP_INSET_PX +
    waterHeight * (1 - before.length / BOTTLE_CAPACITY);
  const streamHeight = Math.max(0, surfaceY - streamTop);
  const color = getWaterColorView(animation.colorIndex).color;

  return {
    left: `${destinationRect.left + destinationRect.width / 2 - 2}px`,
    top: `${streamTop}px`,
    width: "4px",
    height: `${streamHeight}px`,
    backgroundColor: color,
    boxShadow: `0 0 5px ${color}66`,
    zIndex: POUR_LAYER_ORDER.stream,
  };
}
