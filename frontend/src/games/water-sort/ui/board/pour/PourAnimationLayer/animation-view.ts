import type {
  BottleRect,
  PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

export const POUR_ANIMATION_DURATION_MS = 1600;
export const POUR_TRANSFER_START_OFFSET = 0.38;
export const POUR_TRANSFER_END_OFFSET = 0.72;
/** 傾けたボトルが向きを変えるときの動き。 */
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

export function getPourStreamStyle(animation: PourAnimation) {
  const { rect: sourceRect } = animation.source;
  const { rect: destinationRect } = animation.destination;
  const streamTop = destinationRect.top - sourceRect.height * 0.55;
  const streamHeight = destinationRect.top - streamTop + 6;
  const color = getWaterColorView(animation.colorIndex).color;

  return {
    left: `${destinationRect.left + destinationRect.width / 2 - 2}px`,
    top: `${streamTop + 3}px`,
    width: "4px",
    height: `${streamHeight}px`,
    backgroundColor: color,
    boxShadow: `0 0 5px ${color}66`,
    zIndex: POUR_LAYER_ORDER.stream,
  };
}
