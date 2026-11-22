import type { BottleRect } from "@/games/water-sort/ui/board/pour/pour-animation";

/**
 * 注ぐ演出の層の重なり順。プレイ画面の中で、盤面と操作部品より上に、注ぎ先・液の筋・注ぎ元の順で重ねる。
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
