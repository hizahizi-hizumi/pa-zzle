import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";
import {
  CLEAR_LIGHT_START_MS,
  getClearWaveStepMs,
  getClearWaveTiming,
  ISLAND_POP_MS,
  islandPopKeyframes,
  listClearWaveDepths,
} from "@/games/bridges/ui/board/clear-wave";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

/** 島の光が灯り切るまでの時間。 */
const ISLAND_HALO_MS = 360;
/** 最後の島が灯ったときに、海全体へ広がる波紋の時間。 */
const RIPPLE_MS = 900;
/** 灯り切った盤面を、結果へ進める前に見せておく時間。完成した盤面が最も明るい姿なので、見渡せる間を置く。 */
const CLEAR_HOLD_MS = 900;
/** 動きを減らす設定で、灯った盤面を結果へ進める前に見せておく時間。光が渡る時間が無い分を足す。 */
const REDUCED_MOTION_CLEAR_HOLD_MS = 2_000;

const glowKeyframes: Keyframe[] = [
  { strokeDashoffset: 1 },
  { strokeDashoffset: 0 },
];
const haloKeyframes: Keyframe[] = [
  { opacity: 0, transform: "scale(0.6)" },
  { opacity: 1, transform: "scale(1.08)", offset: 0.55 },
  { opacity: 1, transform: "scale(1)" },
];
const rippleKeyframes: Keyframe[] = [
  { opacity: 0.9, transform: "scale(0.05)" },
  { opacity: 0, transform: "scale(1)" },
];

function animateAll(
  elements: Iterable<Element>,
  keyframes: Keyframe[],
  timing: (element: Element) => KeyframeAnimationOptions,
): Animation[] {
  return [...elements].flatMap((element) => {
    const animation = element.animate?.(keyframes, timing(element));
    return animation ? [animation] : [];
  });
}

function readDepth(element: Element, part: string): number {
  return Number(element.getAttribute(part));
}

/**
 * クリアした盤面で、島0 から橋に沿って光を走らせ、光が届いた島を順に灯し、最後の島が灯ったときに海全体へ一度だけ波紋を広げる。
 * 全島がちょうどなのにつながっていない盤面（クリアにならない）と見分けられるよう、光は橋のつながりに沿って渡す。
 * 灯り切った盤面を見せてから `onFinished` を呼ぶ。戻り値は演出を取り消す関数。
 * 動きを減らす設定では、灯り切った盤面をそのまま見せる。
 */
export function playClearWave(
  figure: SVGSVGElement | null,
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
  onFinished: () => void,
): () => void {
  return playAnimations({
    animate() {
      if (!figure) {
        return [];
      }
      const depths = listClearWaveDepths(board, bridges);
      const deepest = Math.max(0, ...depths.map((depth) => depth ?? 0));
      const stepMs = getClearWaveStepMs(deepest);
      const { lastPopPeakMs } = getClearWaveTiming(board, bridges);
      const startAt = (depth: number) => CLEAR_LIGHT_START_MS + depth * stepMs;
      const glows = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.clearGlow}] line`),
        glowKeyframes,
        (line) => ({
          duration: stepMs,
          delay: startAt(
            readDepth(line.parentElement!, bridgesFigureParts.clearGlow),
          ),
          easing: "linear",
          fill: "backwards",
        }),
      );
      const halos = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.clearIslandHalo}]`),
        haloKeyframes,
        (halo) => ({
          duration: ISLAND_HALO_MS,
          delay: startAt(readDepth(halo, bridgesFigureParts.clearIslandHalo)),
          easing: MOTION_EASING.celebrate,
          fill: "backwards",
        }),
      );
      const pops = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.island}]`),
        islandPopKeyframes,
        (island) => ({
          duration: ISLAND_POP_MS,
          delay: startAt(
            depths[readDepth(island, bridgesFigureParts.island)] ?? 0,
          ),
          easing: MOTION_EASING.celebrate,
        }),
      );
      const ripple = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.ripple}]`),
        rippleKeyframes,
        () => ({
          duration: RIPPLE_MS,
          delay: lastPopPeakMs,
          easing: MOTION_EASING.exit,
        }),
      );
      return [...glows, ...halos, ...pops, ...ripple];
    },
    completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
    reducedMotionHoldMs: REDUCED_MOTION_CLEAR_HOLD_MS,
    unanimatedHoldMs: 0,
    onFinished,
  });
}
