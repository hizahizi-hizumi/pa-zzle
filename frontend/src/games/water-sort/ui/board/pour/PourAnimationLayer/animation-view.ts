import type {
  BottleRect,
  PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

export const pourAnimationDurationMs = 1600;
export const pourTransferStartOffset = 0.38;
export const pourTransferEndOffset = 0.72;
export const sourcePourLayerZIndex = 70;
export const destinationPourLayerZIndex = 65;

const streamPourLayerZIndex = 69;

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
    zIndex: streamPourLayerZIndex,
  };
}
