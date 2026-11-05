import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";
import {
  getClearWaveStepMs,
  ISLAND_POP_MS,
  islandPopKeyframes,
  listClearWaveDepths,
} from "@/games/bridges/ui/board/clear-wave";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

/** 波が渡り切った後、つながった盤面を見せておく時間。 */
const CLEAR_HOLD_MS = 600;
/** 動きを減らす設定で、完成した盤面を見せておく時間。波の分の時間を足す。 */
const REDUCED_MOTION_CLEAR_HOLD_MS = 1_500;

/**
 * クリアした盤面で、島0 から橋をたどって島を順に膨らませ、全島が1つにつながったことを見せてから `onFinished` を呼ぶ。
 * 全島がちょうどなのにつながっていない盤面（クリアにならない）と見分けられるよう、橋のつながりに沿って波を渡す。
 * 戻り値は演出を取り消す関数。動きを減らす設定では、完成した盤面をそのまま見せる。
 */
export function playClearWave(
  figure: SVGSVGElement | null,
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
  onFinished: () => void,
): () => void {
  return playAnimations({
    animate() {
      const depths = listClearWaveDepths(board, bridges);
      const deepest = Math.max(0, ...depths.map((depth) => depth ?? 0));
      const stepMs = getClearWaveStepMs(deepest);
      return depths.flatMap((depth, island) => {
        const animation = figure
          ?.querySelector(`[${bridgesFigureParts.island}="${island}"]`)
          ?.animate?.(islandPopKeyframes, {
            duration: ISLAND_POP_MS,
            delay: (depth ?? 0) * stepMs,
            easing: MOTION_EASING.celebrate,
          });
        return animation ? [animation] : [];
      });
    },
    completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
    reducedMotionHoldMs: REDUCED_MOTION_CLEAR_HOLD_MS,
    unanimatedHoldMs: 0,
    onFinished,
  });
}
