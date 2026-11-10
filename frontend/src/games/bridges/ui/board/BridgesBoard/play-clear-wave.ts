import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  bridgesFigureParts,
  LANTERN_SETTLED_OPACITY,
} from "@/games/bridges/ui/board/BridgesFigure";
import {
  getClearWaveTiming,
  ISLAND_POP_MS,
  islandPopKeyframes,
  listClearWaveDepths,
  SEA_LIT_MS,
} from "@/games/bridges/ui/board/clear-wave";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

/** 島の後ろの灯りが灯り、少し引いて落ち着くまでの時間。 */
const LANTERN_MS = 640;
/** 杭の灯りが、島が灯り始めてから点くまでの間と、点き切るまでの時間。 */
const LANTERN_POST_DELAY_MS = 90;
const LANTERN_POST_MS = 220;
/** 1つの波紋が広がって消えるまでの時間と、続く波紋の間隔。 */
const RIPPLE_MS = 800;
const RIPPLE_STAGGER_MS = 200;
/** 灯り切った盤面を、結果へ進める前に見せておく時間。完成した盤面が最も鮮やかな姿なので、見渡せる間を置く。 */
const CLEAR_HOLD_MS = 500;
/** 動きを減らす設定で、灯った盤面を結果へ進める前に見せておく時間。灯りが渡る時間が無い分を足す。 */
const REDUCED_MOTION_CLEAR_HOLD_MS = 2_000;

const lanternKeyframes: Keyframe[] = [
  { opacity: 0, transform: "scale(0.5)" },
  { opacity: 1, transform: "scale(1.1)", offset: 0.4 },
  { opacity: LANTERN_SETTLED_OPACITY, transform: "scale(1)" },
];
const fadeInKeyframes: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
/** 波紋は島の周りに収まる大きさまでにし、島の多い盤面でも重なって盤面を白く霞ませない。 */
const rippleKeyframes: Keyframe[] = [
  { opacity: 0.5, transform: "scale(1)" },
  { opacity: 0, transform: "scale(2)" },
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

function readNumber(element: Element, attribute: string): number {
  return Number(element.getAttribute(attribute));
}

/**
 * クリアした盤面で、島0 から架かった橋をたどった段ごとに島を灯す。灯った島は膨らみ、後ろに暖かい灯り、橋の杭に小さな灯りが点き、
 * 海へ波紋が2重に広がる。最後の島が灯り切ったら、海全体を一段明るい青緑にし、灯りを少し引いて澄んだ姿で止める。
 * 全島がちょうどなのにつながっていない盤面（クリアにならない）と見分けられるよう、灯りは橋のつながりの順に点ける。
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
      const { depthStartMs, seaLitMs } = getClearWaveTiming(board, bridges);
      const startAt = (element: Element, part: string) =>
        depthStartMs[readNumber(element, part)] ?? 0;
      const lanterns = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.lantern}]`),
        lanternKeyframes,
        (lantern) => ({
          duration: LANTERN_MS,
          delay: startAt(lantern, bridgesFigureParts.lantern),
          easing: MOTION_EASING.celebrate,
          fill: "backwards",
        }),
      );
      const posts = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.lanternPost}]`),
        fadeInKeyframes,
        (post) => ({
          duration: LANTERN_POST_MS,
          delay:
            startAt(post, bridgesFigureParts.lanternPost) +
            LANTERN_POST_DELAY_MS,
          easing: MOTION_EASING.enter,
          fill: "backwards",
        }),
      );
      const ripples = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.ripple}]`),
        rippleKeyframes,
        (ripple) => ({
          duration: RIPPLE_MS,
          delay:
            startAt(ripple, bridgesFigureParts.ripple) +
            readNumber(ripple, "data-ring") * RIPPLE_STAGGER_MS,
          easing: MOTION_EASING.exit,
        }),
      );
      const pops = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.island}]`),
        islandPopKeyframes,
        (island) => ({
          duration: ISLAND_POP_MS,
          delay:
            depthStartMs[
              depths[readNumber(island, bridgesFigureParts.island)] ?? 0
            ] ?? 0,
          easing: MOTION_EASING.celebrate,
        }),
      );
      const sea = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.seaLit}]`),
        fadeInKeyframes,
        () => ({
          duration: SEA_LIT_MS,
          delay: seaLitMs,
          easing: MOTION_EASING.standard,
          fill: "backwards",
        }),
      );
      return [...lanterns, ...posts, ...ripples, ...pops, ...sea];
    },
    completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
    reducedMotionHoldMs: REDUCED_MOTION_CLEAR_HOLD_MS,
    unanimatedHoldMs: 0,
    onFinished,
  });
}
