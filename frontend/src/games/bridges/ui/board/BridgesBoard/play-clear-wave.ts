import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";
import {
  getClearWaveTiming,
  ISLAND_POP_MS,
  islandPopKeyframes,
  listClearWaveDepths,
} from "@/games/bridges/ui/board/clear-wave";
import { MOTION_EASING, playAnimations } from "@/lib/motion";

/**
 * 全部の島に光が届いた盤面を、結果へ進める前に見せておく時間。明るい木の色になった橋と、ちょうどの緑の島がそろった姿を
 * 一拍止めて見せる。最後の手から結果へ移るまでを、ほかのゲームの完成演出の長さ（1〜2.5 秒ほど）に収める。
 */
const CLEAR_HOLD_MS = 520;
/** 動きを減らす設定で、明るい木の色の橋がそろった盤面を結果へ進める前に見せておく時間。光が渡る時間が無い分を足す。 */
const REDUCED_MOTION_CLEAR_HOLD_MS = 2_000;

/** 段の違う島を結ぶ板は、段の浅い島の中心を起点に、相手の島へ向けて明るい木の色を伸ばす。 */
function collapsedTransform(axis: string | null): string {
  return axis === "y" ? "scale(1, 0)" : "scale(0, 1)";
}

const fadeInKeyframes: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];

function animateAll(
  elements: Iterable<Element>,
  animate: (element: Element) => Animation | undefined,
): Animation[] {
  return [...elements].flatMap((element) => {
    const animation = animate(element);
    return animation ? [animation] : [];
  });
}

function readNumber(element: Element, attribute: string): number {
  return Number(element.getAttribute(attribute));
}

/**
 * 全部の島が橋でつながったことを、橋のつながりをたどる光で見せる。最後に架けた橋 `originEdge` が着いたら、その両端の島を弾ませ、
 * 架かった橋の板を明るい木の色に変えながら相手の島へ光を渡し、光が着いた島を順に弾ませる。全部の島に届いたら、明るい橋と
 * 緑の島がそろった姿で一拍止めてから `onFinished` を呼ぶ。戻り値は演出を取り消す関数。
 * 全島がちょうどなのにつながっていない盤面（クリアにならない）と見分けられるよう、光は橋のつながりの順に渡す。
 * 動きを減らす設定では、光が渡り切った盤面をそのまま見せる。
 */
export function playClearWave(
  figure: SVGSVGElement | null,
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
  originEdge: number | null,
  onFinished: () => void,
): () => void {
  return playAnimations({
    animate() {
      if (!figure) {
        return [];
      }
      const depths = listClearWaveDepths(board, bridges, originEdge);
      const { depthStartMs, stepMs } = getClearWaveTiming(
        board,
        bridges,
        originEdge,
      );
      const decks = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.litDeck}]`),
        (deck) => {
          const delay =
            depthStartMs[readNumber(deck, bridgesFigureParts.litDeck)] ?? 0;
          if (deck.getAttribute("data-spread") === "fade") {
            return deck.animate?.(fadeInKeyframes, {
              duration: stepMs,
              delay,
              easing: MOTION_EASING.enter,
              fill: "backwards",
            });
          }
          return deck.animate?.(
            [
              { transform: collapsedTransform(deck.getAttribute("data-axis")) },
              { transform: "none" },
            ],
            { duration: stepMs, delay, easing: "linear", fill: "backwards" },
          );
        },
      );
      const pops = animateAll(
        figure.querySelectorAll(`[${bridgesFigureParts.island}]`),
        (island) =>
          island.animate?.(islandPopKeyframes, {
            duration: ISLAND_POP_MS,
            delay:
              depthStartMs[
                depths[readNumber(island, bridgesFigureParts.island)] ?? 0
              ] ?? 0,
            easing: MOTION_EASING.celebrate,
          }),
      );
      return [...decks, ...pops];
    },
    completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
    reducedMotionHoldMs: REDUCED_MOTION_CLEAR_HOLD_MS,
    unanimatedHoldMs: 0,
    onFinished,
  });
}
