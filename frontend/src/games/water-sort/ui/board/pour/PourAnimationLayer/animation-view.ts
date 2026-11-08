import type {
  BottleRect,
  PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

export const POUR_ANIMATION_DURATION_MS = 1600;
export const GLASS_POUR_DURATION_MS = 1200;

export function pourDuration(appearance: WaterSortAppearance) {
  return appearance === "glass"
    ? GLASS_POUR_DURATION_MS
    : POUR_ANIMATION_DURATION_MS;
}
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

export function getPourTiltDirection(rect: BottleRect, viewportWidth: number) {
  const centerX = rect.left + rect.width / 2;
  return centerX < viewportWidth / 2 ? -1 : 1;
}

export const GLASS_POUR_TILT_DEGREES = 100;

export function getGlassPourPose(
  source: BottleRect,
  destination: BottleRect,
  viewportWidth: number,
) {
  const direction = getPourTiltDirection(destination, viewportWidth);
  const radians = (GLASS_POUR_TILT_DEGREES * Math.PI) / 180;
  const tipProjectionX = (source.width / 2) * Math.cos(radians);
  const tipProjectionY = (source.width / 2) * Math.sin(radians);
  const streamTop = destination.top - Math.min(32, source.height * 0.22);
  const dockingTop = streamTop - tipProjectionY;
  return {
    direction,
    tiltDegrees: direction * GLASS_POUR_TILT_DEGREES,
    offsetX:
      destination.left +
      destination.width / 2 -
      (source.left + source.width / 2) -
      direction * tipProjectionX,
    offsetY: dockingTop - source.top,
    streamTop,
  };
}

export function getOverlayStyle(rect: BottleRect, zIndex: number) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex,
  };
}

export function getPourStreamStyle(
  animation: PourAnimation,
  appearance: WaterSortAppearance,
) {
  const { rect: sourceRect } = animation.source;
  const { rect: destinationRect } = animation.destination;
  const color = getWaterColorView(animation.colorIndex).color;
  const isGlass = appearance === "glass";
  const streamTop = isGlass
    ? getGlassPourPose(sourceRect, destinationRect, window.innerWidth).streamTop
    : destinationRect.top - sourceRect.height * 0.55;
  const streamHeight = destinationRect.top - streamTop + 6;

  return {
    left: `${destinationRect.left + destinationRect.width / 2 - 2}px`,
    top: `${streamTop + 3}px`,
    width: isGlass ? "5px" : "4px",
    height: `${streamHeight}px`,
    backgroundColor: color,
    boxShadow: isGlass ? "none" : `0 0 5px ${color}66`,
    zIndex: POUR_LAYER_ORDER.stream,
  };
}
