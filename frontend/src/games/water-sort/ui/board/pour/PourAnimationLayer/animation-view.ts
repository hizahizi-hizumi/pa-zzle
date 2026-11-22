import type { BottleRect } from "@/games/water-sort/ui/board/pour/pour-path";

/**
 * 注ぐ演出の層の重なり順。プレイ画面の中で、盤面と操作部品より上に、注ぎ先・注ぎ元の順で重ねる。
 * 値はプレイ画面の重なりの中だけで使う。
 */
export const POUR_LAYER_ORDER = {
  destination: 1,
  source: 2,
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

/**
 * 注ぎごとの時計。注ぎ元を動かす Web Animation の進み具合を、注ぎ元の液・流れ・注ぎ先の液が同じ時刻で読む。
 * 止めた・巻き戻したときも、液は試験管と同じ時刻の姿になる。
 */
export type PourClocks = {
  start: (animationId: number, animation: Animation) => void;
  stop: (animationId: number) => void;
  /** 時計がまだ動いていなければ 0。 */
  getElapsedMs: (animationId: number) => number;
};

export function createPourClocks(): PourClocks {
  const animations = new Map<number, Animation>();
  return {
    start(animationId, animation) {
      animations.set(animationId, animation);
    },
    stop(animationId) {
      animations.delete(animationId);
    },
    getElapsedMs(animationId) {
      const currentTime = animations.get(animationId)?.currentTime;
      return typeof currentTime === "number" ? currentTime : 0;
    },
  };
}
