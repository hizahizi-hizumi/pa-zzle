import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";

/**
 * 阻んだ橋の点灯。すぐ点け、目を向けてから読める間を置いてゆっくり消す。次の操作の邪魔にならないよう、0.9秒で消し切る。
 * 動かない点灯なので、動きを減らす設定でも返す。
 */
const BLOCKING_FLASH_MS = 900;
const blockingFlashKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: 0.06 },
  { opacity: 1, offset: 0.6 },
  { opacity: 0 },
];

/**
 * 交わる橋に阻まれて架けられなかったことを盤面で返す。押した所ではなく、阻んだ橋を規則に合わない色で短く点け、
 * 何に阻まれたかを形で知らせる。文字は出さない。
 */
export function animateBlockingBridges(figure: SVGSVGElement | null): void {
  figure
    ?.querySelector(`[${bridgesFigureParts.blockingBridges}]`)
    ?.animate?.(blockingFlashKeyframes, {
      duration: BLOCKING_FLASH_MS,
      easing: "ease-out",
    });
}
