import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";

/**
 * 盤面の線の点灯。すぐ点け、目を向けてから読める間を置いてゆっくり消す。次の操作の邪魔にならないよう、0.9秒で消し切る。
 * 動かない点灯なので、動きを減らす設定でも返す。
 */
const FLASH_MS = 900;
const flashKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.9, offset: 0.06 },
  { opacity: 0.9, offset: 0.6 },
  { opacity: 0 },
];

/**
 * 交わる橋に阻まれて架けられなかったことを、阻んだ橋を短く点けて返す。文字は出さない。
 * 押した所ではなく、阻んだ橋を規則に合わない色で点け、何に阻まれたかを形で知らせる。
 */
export function flashBlockingBridges(figure: SVGSVGElement | null): void {
  figure
    ?.querySelector(`[${bridgesFigureParts.blockingBridges}]`)
    ?.animate?.(flashKeyframes, { duration: FLASH_MS, easing: "ease-out" });
}
